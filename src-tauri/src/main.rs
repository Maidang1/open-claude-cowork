#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use serde_json::Value;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[derive(Clone)]
struct AppState {
  sidecar_port: Arc<Mutex<Option<u16>>>,
}

#[derive(Deserialize)]
struct SidecarEvent {
  channel: String,
  payload: Value,
}

fn quote_for_bash(value: &str) -> String {
  format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn quote_for_cmd(value: &str) -> String {
  format!("\"{}\"", value.replace('"', "\"\""))
}

fn resolve_sidecar_path(input: &str) -> String {
  if Path::new(input).is_absolute() {
    return input.to_string();
  }

  let cwd = std::env::current_dir().unwrap_or_else(|_| ".".into());
  let first = cwd.join(input);
  if first.exists() {
    return first.to_string_lossy().to_string();
  }

  if cwd.file_name().and_then(|name| name.to_str()) == Some("src-tauri") {
    let parent = cwd.parent().unwrap_or(&cwd);
    let second = parent.join(input);
    if second.exists() {
      return second.to_string_lossy().to_string();
    }
  }

  first.to_string_lossy().to_string()
}

#[tauri::command]
async fn get_sidecar_port(state: tauri::State<'_, AppState>) -> Result<u16, String> {
  state
    .sidecar_port
    .lock()
    .unwrap()
    .ok_or_else(|| "Sidecar not ready".to_string())
}

fn main() {
  let app_state = AppState {
    sidecar_port: Arc::new(Mutex::new(None)),
  };

  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(app_state)
    .setup(|app| {
      let state = app.state::<AppState>();
      let port_mutex = state.sidecar_port.clone();
      let app_handle = app.handle().clone();
      let app_data_dir = app
        .path()
        .app_data_dir()
        .ok()
        .map(|path| path.to_string_lossy().to_string());

      tauri::async_runtime::spawn(async move {
        let shell = app_handle.shell();
        
        let (mut rx, _child) = if cfg!(debug_assertions) {
          let sidecar_js = std::env::var("TAURI_SIDECAR_JS")
            .unwrap_or_else(|_| "src-tauri/binaries/node-sidecar.js".to_string());
          let resolved = resolve_sidecar_path(&sidecar_js);
          if !Path::new(&resolved).exists() {
            app_handle
              .emit("sidecar:stderr", format!("sidecar js not found: {resolved}"))
              .ok();
            eprintln!("[sidecar] js not found: {resolved}");
          }
          let is_windows = cfg!(target_os = "windows");
          let node_cmd = std::env::var("TAURI_NODE_CMD").unwrap_or_else(|_| "node".to_string());
          let cmd = if is_windows {
            format!("{} {}", node_cmd, quote_for_cmd(&resolved))
          } else {
            format!("{} {}", node_cmd, quote_for_bash(&resolved))
          };
          app_handle
            .emit("sidecar:stderr", format!("starting sidecar (dev): {cmd}"))
            .ok();
          eprintln!("[sidecar] starting (dev): {cmd}");
          
          let mut command = if is_windows {
            shell.command("cmd").args(["/C", &cmd])
          } else {
            shell.command("bash").args(["-lc", &cmd])
          };
          
          if let Some(dir) = &app_data_dir {
            command = command.env("TAURI_APP_DATA_DIR", dir);
          }
          
          match command.spawn() {
            Ok(result) => result,
            Err(err) => {
              app_handle
                .emit("sidecar:stderr", format!("spawn failed: {err}"))
                .ok();
              eprintln!("[sidecar] spawn failed: {err}");
              return;
            }
          }
        } else {
          app_handle
            .emit("sidecar:stderr", "starting sidecar (release)".to_string())
            .ok();
          eprintln!("[sidecar] starting (release)");
          
          let mut command = shell.sidecar("node-sidecar")
            .expect("failed to create sidecar command");
          
          if let Some(dir) = &app_data_dir {
            command = command.env("TAURI_APP_DATA_DIR", dir);
          }
          
          match command.spawn() {
            Ok(result) => result,
            Err(err) => {
              app_handle
                .emit("sidecar:stderr", format!("spawn failed: {err}"))
                .ok();
              eprintln!("[sidecar] spawn failed: {err}");
              return;
            }
          }
        };

        while let Some(event) = rx.recv().await {
          match event {
            CommandEvent::Stdout(bytes) => {
              let line = String::from_utf8_lossy(&bytes).to_string();
              if let Some(port_str) = line.strip_prefix("SIDECAR_PORT:") {
                if let Ok(port) = port_str.trim().parse::<u16>() {
                  *port_mutex.lock().unwrap() = Some(port);
                  app_handle.emit("sidecar:ready", port).ok();
                }
              } else if let Some(event_str) = line.strip_prefix("EVENT:") {
                if let Ok(event) = serde_json::from_str::<SidecarEvent>(event_str.trim()) {
                  app_handle.emit(&event.channel, event.payload).ok();
                }
              }
              app_handle.emit("sidecar:stdout", line).ok();
            }
            CommandEvent::Stderr(bytes) => {
              let line = String::from_utf8_lossy(&bytes).to_string();
              app_handle.emit("sidecar:stderr", line).ok();
            }
            _ => {}
          }
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_sidecar_port])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
