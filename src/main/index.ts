import path, { resolve } from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ACPClient } from "./acp/Client";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

const execAsync = promisify(exec);

export let mainWindow: BrowserWindow | null = null;
let acpClient: ACPClient | null = null;

export const isDev = !app.isPackaged;
const loadUrl: string = isDev
  ? `http://localhost:${process.env._PORT}`
  : `file://${path.resolve(__dirname, "../render/index.html")}`;

const getAgentsDir = () => path.join(app.getPath("userData"), "agents");

const getLocalAgentBin = (command: string) => {
  const agentsDir = getAgentsDir();
  const binPath = path.join(agentsDir, "node_modules", ".bin", command);
  return existsSync(binPath) ? binPath : null;
};

const initIpc = () => {
  ipcMain.on("ping", () => {
    dialog.showMessageBox(mainWindow!, {
      message: "hello",
    });
  });

  ipcMain.handle("dialog:openFolder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
  });

  // ACP IPC Handlers
  ipcMain.handle(
    "agent:connect",
    async (_, command: string, cwd?: string, env?: Record<string, string>) => {
      if (!acpClient) {
        acpClient = new ACPClient((msg) => {
          // Forward agent messages to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("agent:message", msg);
          }
        });
      }

      // Command splitting (naive)
      const parts = command.split(" ");
      let cmd = parts[0];
      const args = parts.slice(1);

      // Check if it's a local agent
      const localBin = getLocalAgentBin(cmd);
      if (localBin) {
        console.log(`[Main] Using local agent binary: ${localBin}`);
        // Ensure execution permission for local binary
        try {
          await fs.chmod(localBin, 0o755);
        } catch (e) {
          console.error(`[Main] Failed to chmod local bin: ${e}`);
        }

        // Special handling for node scripts (like qwen which is a symlink to cli.js)
        // If we just execute the JS file directly, it might fail if shebang is not respected or env is weird
        // So we prefix with 'node' if it looks like a JS file or we know it's a node script
        if (localBin.endsWith(".js") || cmd === "qwen") {
          // Quote the path because Client.ts uses { shell: true } which requires manual quoting for paths with spaces
          args.unshift(`"${localBin}"`);
          
          // Try to resolve absolute path to node
          try {
            const { stdout } = await execAsync("which node");
            cmd = stdout.trim();
            console.log(`[Main] Resolved system node path: ${cmd}`);
          } catch (e) {
            // Fallback to bundled node if system node not found
            const bundledNode = path.resolve(__dirname, "../../resources/node_bin/node");
            if (existsSync(bundledNode)) {
               cmd = bundledNode;
               console.log(`[Main] Using bundled node path: ${cmd}`);
            } else {
               console.warn("[Main] Failed to resolve node path and no bundled node found, falling back to 'node'");
               cmd = "node";
            }
          }
        } else {
          cmd = localBin;
        }
      }

      try {
        await acpClient.connect(cmd, args, cwd, env);
        return { success: true };
      } catch (e: any) {
        console.error("Connect error:", e);
        return { success: false, error: e.message };
      }
    },
  );

  ipcMain.handle("agent:check-command", async (_, command: string) => {
    // 1. Check local agent
    if (getLocalAgentBin(command)) {
      return { installed: true, source: "local" };
    }

    // 2. Check system
    try {
      await execAsync(`which ${command}`);
      return { installed: true, source: "system" };
    } catch {
      // 3. Special check for Node environment availability
      if (command === "node") {
        // Check bundled node
        const bundledNode = path.resolve(__dirname, "../../resources/node_bin/node");
        if (existsSync(bundledNode)) {
          return { installed: true, source: "bundled" };
        }
      }
      return { installed: false };
    }
  });

  ipcMain.handle("agent:install", async (_, packageName: string) => {
    const agentsDir = getAgentsDir();
    try {
      // Ensure dir exists
      if (!existsSync(agentsDir)) {
        await fs.mkdir(agentsDir, { recursive: true });
        // Init package.json if needed
        await fs.writeFile(path.join(agentsDir, "package.json"), "{}", "utf-8");
      }

      // Install
      console.log(`[Main] Installing ${packageName} to ${agentsDir}...`);
      // We rely on system npm for now, but in future could use bundled npm
      // Quote paths to handle spaces
      await execAsync(`npm install ${packageName}`, { cwd: agentsDir });
      return { success: true };
    } catch (e: any) {
      console.error("Install error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agent:auth-terminal", async (_, command: string, cwd?: string) => {
    // Resolve full path if it's a local agent command (e.g. "qwen")
    let targetCmd = command;
    let localBin = getLocalAgentBin(command);

    if (localBin) {
      // If it's a JS/Node script, prefix with node
      if (localBin.endsWith(".js") || command === "qwen") {
         let nodePath = "node";
         // Try to find absolute node path
         try {
           const { stdout } = await execAsync("which node");
           nodePath = stdout.trim();
         } catch {
            const bundledNode = path.resolve(__dirname, "../../resources/node_bin/node");
            if (existsSync(bundledNode)) {
               nodePath = bundledNode;
            }
         }
         targetCmd = `"${nodePath}" "${localBin}"`;
      } else {
         targetCmd = `"${localBin}"`;
      }
    }

    console.log(`[Main] Launching auth terminal for: ${targetCmd} in ${cwd || "default cwd"}`);

    try {
      if (process.platform === "darwin") {
        // macOS: Open Terminal
        // If cwd is provided, cd to it first
        const script = cwd 
          ? `cd "${cwd.replace(/"/g, '\\"')}" && ${targetCmd.replace(/"/g, '\\"')}`
          : targetCmd.replace(/"/g, '\\"');
        
        await execAsync(`osascript -e 'tell application "Terminal" to do script "${script}"'`);
        await execAsync(`osascript -e 'tell application "Terminal" to activate'`);
      } else if (process.platform === "win32") {
        // Windows: Start cmd
        const options = cwd ? { cwd } : {};
        await execAsync(`start cmd /k "${targetCmd}"`, options);
      } else {
        // Linux: Try x-terminal-emulator or gnome-terminal
        const cdCmd = cwd ? `cd "${cwd}" && ` : "";
        await execAsync(`x-terminal-emulator -e "bash -c '${cdCmd}${targetCmd}; exec bash'" || gnome-terminal -- bash -c "${cdCmd}${targetCmd}; exec bash"`);
      }
      return { success: true };
    } catch (e: any) {
      console.error("Auth terminal error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agent:send", async (_, message: string) => {
    if (acpClient) {
      await acpClient.sendMessage(message);
    } else {
      throw new Error("Agent not connected");
    }
  });

  ipcMain.handle("agent:disconnect", () => {
    if (acpClient) {
      acpClient.disconnect();
      acpClient = null;
    }
    return { success: true };
  });
};

const onCreateMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    minWidth: 1000,
    height: 900,
    minHeight: 700,
    icon: resolve(__dirname, "../../../../assets/icons/256x256.png"),
    webPreferences: {
      devTools: isDev,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(__dirname, "./preload.js"),
    },
  });
  mainWindow.loadURL(loadUrl);
};

app.on("ready", async () => {
  initIpc();
  onCreateMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    onCreateMainWindow();
  }
});
