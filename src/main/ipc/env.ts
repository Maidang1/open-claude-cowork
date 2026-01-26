import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { type BrowserWindow, clipboard, ipcMain, shell } from "electron";
import { getSetting, setSetting } from "../db/store";
import {
  enrichPathFromLoginShell,
  getCustomNodePath,
  getNodeRuntimePreference,
  normalizeNodeRuntimePreference,
  resolveNodeRuntime,
  setNodeRuntimePreference,
} from "../utils/node-runtime";
import { resolveSystemCommand, shellQuote } from "../utils/shell";

const execAsync = promisify(exec);

export const registerEnvHandlers = (_mainWindow: BrowserWindow | null) => {
  ipcMain.handle("env:check", async () => {
    const result = {
      node: {
        installed: false,
        version: null as string | null,
        path: null as string | null,
      },
      npm: { installed: false, version: null as string | null },
      platform: process.platform,
      arch: process.arch,
    };

    try {
      const nodeRuntime = await resolveNodeRuntime();
      if (nodeRuntime.file === process.execPath) {
        result.node.installed = true;
        result.node.version = `v${process.versions.node}`;
        result.node.path = nodeRuntime.file;
      } else {
        const { stdout: nodeVersion } = await execAsync(
          `${shellQuote(nodeRuntime.file)} --version`,
        );
        result.node.installed = true;
        result.node.version = nodeVersion.trim();
        result.node.path = nodeRuntime.file;
      }
    } catch (primaryErr) {
      // Try system node before giving up
      try {
        getCustomNodePath();
        await enrichPathFromLoginShell();
        const systemNode = await resolveSystemCommand("node");
        const nodeCmd = shellQuote(systemNode || "node");
        const { stdout: nodeVersion } = await execAsync(`${nodeCmd} --version`);
        result.node.installed = true;
        result.node.version = nodeVersion.trim();
        result.node.path = systemNode || "node";
      } catch (fallbackErr) {
        console.warn("[Env] Failed to resolve Node.js runtime", primaryErr, fallbackErr);
      }
    }

    try {
      getCustomNodePath();
      await enrichPathFromLoginShell();
      const systemNpm = await resolveSystemCommand("npm");
      if (!systemNpm) {
        throw new Error("npm not found on PATH");
      }
      const pmCmd = shellQuote(systemNpm);
      const { stdout: pmVersion } = await execAsync(`${pmCmd} --version`);
      result.npm.installed = true;
      result.npm.version = pmVersion.trim();
    } catch (npmErr) {
      console.warn("[Env] Failed to resolve npm", npmErr);
    }

    return result;
  });

  ipcMain.handle("env:open-url", async (_, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle("env:copy-to-clipboard", async (_, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle("env:validate-node-path", async (_, nodePath: string) => {
    try {
      if (!existsSync(nodePath)) {
        return { valid: false, error: "File does not exist" };
      }
      const { stdout } = await execAsync(`${shellQuote(nodePath)} --version`);
      const version = stdout.trim();
      if (!version.startsWith("v")) {
        return { valid: false, error: "Not a valid Node.js executable" };
      }
      return { valid: true, version };
    } catch (e: any) {
      return { valid: false, error: e.message || "Failed to execute" };
    }
  });

  ipcMain.handle("env:set-custom-node-path", async (_, nodePath: string) => {
    if (!nodePath) {
      setSetting("custom_node_path", "");
      setSetting("node_runtime_preference", "system");
    } else {
      setSetting("custom_node_path", nodePath);
      setSetting("node_runtime_preference", "custom");
    }
    return { success: true };
  });

  ipcMain.handle("env:get-custom-node-path", async () => {
    return getSetting("custom_node_path");
  });

  ipcMain.handle("env:get-node-runtime", async () => {
    return getNodeRuntimePreference();
  });

  ipcMain.handle("env:set-node-runtime", async (_, runtime: string) => {
    const normalized = normalizeNodeRuntimePreference(runtime);
    if (!normalized) {
      return { success: false, error: "Invalid runtime value" };
    }
    setNodeRuntimePreference(normalized);
    return { success: true };
  });

  ipcMain.handle("env:get-wallpaper", async () => {
    return getSetting("wallpaper_path");
  });

  ipcMain.handle("env:set-wallpaper", async (_, wallpaperPath: string) => {
    setSetting("wallpaper_path", wallpaperPath);
    return { success: true };
  });

  ipcMain.handle("env:clear-wallpaper", async () => {
    setSetting("wallpaper_path", "");
    return { success: true };
  });

  ipcMain.handle("env:run-install-command", async (_, command: string) => {
    console.log(`[Install] Running command: ${command}`);

    try {
      let shellCmd: string;
      let shellArgs: string[];

      if (process.platform === "win32") {
        shellCmd = "powershell.exe";
        shellArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command];
      } else {
        const setupCmd = `
          export NVM_DIR="$HOME/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
          ${command}
        `;
        shellCmd = "/bin/bash";
        shellArgs = ["-l", "-c", setupCmd];
      }

      const { spawn } = await import("node:child_process");

      return new Promise((resolve, reject) => {
        const child = spawn(shellCmd, shellArgs, {
          env: { ...process.env, TERM: "xterm-256color" },
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          const output = (stdout + stderr).trim();
          console.log(`[Install] Command finished with code ${code}`);
          console.log(`[Install] Output: ${output.substring(0, 500)}...`);

          if (code === 0) {
            resolve({ success: true, output });
          } else {
            reject(new Error(output || `Command failed with exit code ${code}`));
          }
        });

        child.on("error", (err) => {
          reject(err);
        });

        setTimeout(
          () => {
            child.kill();
            reject(new Error("Installation timed out after 5 minutes"));
          },
          5 * 60 * 1000,
        );
      });
    } catch (e: any) {
      console.error(`[Install] Error:`, e);
      throw e;
    }
  });
};
