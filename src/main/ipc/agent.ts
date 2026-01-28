import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { type BrowserWindow, ipcMain } from "electron";
import { AcpAgentManager } from "../acp/AcpAgentManager";
import { acpDetector } from "../acp/AcpDetector";
import {
  enrichPathFromLoginShell,
  getCustomNodePath,
  getNodeRuntimePreference,
  resolveAuthCommand,
} from "../utils/node-runtime";
import {
  buildCommandString,
  buildEnvPrefix,
  extractPackageName,
  getAgentsDir,
  getLocalAgentBin,
  readInstalledPackageVersion,
  resolveSystemCommand,
  shellQuote,
  toLatestSpecifier,
} from "../utils/shell";

const execAsync = promisify(exec);

const acpManagers = new Map<string, AcpAgentManager>();

const getAcpManager = (taskId?: string) => {
  if (!taskId) {
    throw new Error("Task id is required");
  }
  const manager = acpManagers.get(taskId);
  if (!manager) {
    throw new Error("Agent not connected");
  }
  return manager;
};

type PackageManager = {
  kind: "npm";
  cmd: string;
  source: "system";
};

const resolvePackageManager = async (): Promise<PackageManager> => {
  await enrichPathFromLoginShell();
  const systemNpm = await resolveSystemCommand("npm");
  return { kind: "npm", cmd: systemNpm || "npm", source: "system" };
};

export const registerAgentHandlers = (mainWindow: BrowserWindow | null) => {
  ipcMain.handle(
    "agent:connect",
    async (
      _,
      taskId: string,
      command: string,
      cwd?: string,
      env?: Record<string, string>,
      options?: { reuseIfSame?: boolean; createSession?: boolean },
    ) => {
      try {
        if (!taskId) {
          return { success: false, error: "Task id is required" };
        }
        let manager = acpManagers.get(taskId);
        if (!manager) {
          manager = new AcpAgentManager((msg) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (typeof msg === "string") {
                mainWindow.webContents.send("agent:message", {
                  type: "agent_text",
                  text: msg,
                  taskId,
                });
                return;
              }
              mainWindow.webContents.send("agent:message", { ...msg, taskId });
            }
          });
          acpManagers.set(taskId, manager);
        }
        return await manager.connect(command, cwd, env, options);
      } catch (e: any) {
        console.error("Connect error:", e);
        return { success: false, error: e.message || "Connection failed" };
      }
    },
  );

  ipcMain.handle("agent:check-command", async (_, command: string) => {
    if (getLocalAgentBin(command)) {
      return { installed: true, source: "local" };
    }

    if (command === "node") {
      const preference = getNodeRuntimePreference();
      if (preference === "custom") {
        const customNodePath = getCustomNodePath();
        if (customNodePath) {
          return { installed: true, source: "custom" };
        }
        return { installed: false, source: "custom" };
      }
      return { installed: true, source: "system" };
    }

    try {
      const whichCmd = process.platform === "win32" ? "where" : "which";
      await execAsync(`${whichCmd} ${command}`);
      return { installed: true, source: "system" };
    } catch {
      return { installed: false };
    }
  });

  ipcMain.handle("agent:get-available-agents", async () => {
    return await acpDetector.getAvailableAgents();
  });

  ipcMain.handle("agent:detect-cli-path", async (_, command: string) => {
    return await acpDetector.detectCliPath(command);
  });

  ipcMain.handle("agent:get-package-version", async (_, packageName: string) => {
    const pkgName = extractPackageName(packageName);
    if (!pkgName) {
      return { success: false, error: "Invalid package name" };
    }
    try {
      const version = await readInstalledPackageVersion(pkgName);
      if (version) {
        return { success: true, version };
      }
      return { success: false, error: "Package not installed" };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agent:install", async (_, packageName: string) => {
    const agentsDir = getAgentsDir();
    try {
      if (!existsSync(agentsDir)) {
        await fs.mkdir(agentsDir, { recursive: true });
        await fs.writeFile(
          `${agentsDir}/package.json`,
          '{"name": "agents", "version": "1.0.0"}',
          "utf-8",
        );
      }

      const pkgName = extractPackageName(packageName);
      const latestSpecifier = toLatestSpecifier(packageName);
      const pm = await resolvePackageManager();
      const pmCmd = shellQuote(pm.cmd);

      if (pkgName) {
        try {
          const removeCmd = `${pmCmd} uninstall ${pkgName}`;
          await execAsync(removeCmd, { cwd: agentsDir });
        } catch (uninstallErr) {
          console.warn(
            `[Main] package remove ${pkgName} failed (likely not installed): ${uninstallErr}`,
          );
        }
      }

      console.log(
        `[Main] Installing ${latestSpecifier} to ${agentsDir} using ${pm.kind} (${pm.source})...`,
      );
      const installCmd = `${pmCmd} install ${latestSpecifier}`;
      await execAsync(installCmd, { cwd: agentsDir });
      return { success: true };
    } catch (e: any) {
      console.error("Install error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agent:uninstall", async (_, packageName: string) => {
    const pkgName = extractPackageName(packageName);
    if (!pkgName) {
      return { success: false, error: "Invalid package name" };
    }

    const agentsDir = getAgentsDir();
    if (!existsSync(agentsDir)) {
      return { success: true };
    }

    const existingVersion = await readInstalledPackageVersion(pkgName);
    if (!existingVersion) {
      return { success: true };
    }

    try {
      const pm = await resolvePackageManager();
      const pmCmd = shellQuote(pm.cmd);
      console.log(
        `[Main] Uninstalling ${pkgName} from ${agentsDir} using ${pm.kind} (${pm.source})...`,
      );
      const removeCmd = `${pmCmd} uninstall ${pkgName}`;
      await execAsync(removeCmd, { cwd: agentsDir });
      return { success: true };
    } catch (e: any) {
      console.error("Uninstall error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agent:auth-terminal", async (_, command: string, cwd?: string) => {
    let resolved: Awaited<ReturnType<typeof resolveAuthCommand>> | null = null;
    try {
      resolved = await resolveAuthCommand(command);
    } catch (e: any) {
      return {
        success: false,
        error: e.message || "Failed to resolve command",
      };
    }
    if (!resolved) {
      return { success: false, error: "Invalid command" };
    }

    const targetCmd = buildCommandString(resolved.file, resolved.args);
    const envPrefix = buildEnvPrefix(resolved.env);
    const targetWithEnv = envPrefix ? `${envPrefix}${targetCmd}` : targetCmd;

    console.log(`[Main] Launching auth terminal for: ${targetWithEnv} in ${cwd || "default cwd"}`);

    try {
      if (process.platform === "darwin") {
        const cdPrefix = cwd ? `cd ${JSON.stringify(cwd)} && ` : "";
        const script = `${cdPrefix}${targetWithEnv}`.trim();
        const escapedScript = script.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

        await execAsync(
          `osascript -e 'tell application "Terminal" to do script "${escapedScript}"'`,
        );
        await execAsync(`osascript -e 'tell application "Terminal" to activate'`);
      } else if (process.platform === "win32") {
        const options = cwd ? { cwd } : {};
        await execAsync(`start cmd /k "${targetWithEnv}"`, options);
      } else {
        const cdCmd = cwd ? `cd "${cwd}" && ` : "";
        await execAsync(
          `x-terminal-emulator -e "bash -c '${cdCmd}${targetWithEnv}; exec bash'" || gnome-terminal -- bash -c "${cdCmd}${targetWithEnv}; exec bash"`,
        );
      }
      return { success: true };
    } catch (e: any) {
      console.error("Auth terminal error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agent:permission-response", (_, taskId: string, id: string, response: any) => {
    try {
      const manager = getAcpManager(taskId);
      manager.resolvePermission(id, response);
    } catch (e: any) {
      console.warn("Permission response error:", e?.message || e);
    }
  });

  ipcMain.handle(
    "agent:send",
    async (
      _,
      taskId: string,
      message: string,
      images?: Array<{ mimeType: string; dataUrl: string }>,
    ) => {
      const manager = getAcpManager(taskId);
      await manager.sendMessage(message, images);
    },
  );

  ipcMain.handle("agent:get-capabilities", async (_, taskId: string) => {
    const manager = getAcpManager(taskId);
    return manager.getCapabilities() ?? null;
  });

  ipcMain.handle("agent:new-session", async (_, taskId: string, cwd?: string, mcpServers?: any[]) => {
    const manager = getAcpManager(taskId);
    return await manager.createSession(cwd, mcpServers);
  });

  ipcMain.handle(
    "agent:load-session",
    async (_, taskId: string, sessionId: string, cwd?: string, mcpServers?: any[]) => {
      const manager = getAcpManager(taskId);
      return await manager.loadSession(sessionId, cwd, mcpServers);
    },
  );

  ipcMain.handle(
    "agent:resume-session",
    async (_, taskId: string, sessionId: string, cwd?: string, mcpServers?: any[]) => {
      const manager = getAcpManager(taskId);
      return await manager.resumeSession(sessionId, cwd, mcpServers);
    },
  );

  ipcMain.handle(
    "agent:set-active-session",
    async (_, taskId: string, sessionId: string, cwd?: string) => {
      const manager = getAcpManager(taskId);
      return await manager.setActiveSession(sessionId, cwd);
    },
  );

  ipcMain.handle("agent:set-model", async (_, taskId: string, modelId: string) => {
    try {
      const manager = getAcpManager(taskId);
      return await manager.setModel(modelId);
    } catch (e: any) {
      console.error("Set model error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agent:disconnect", async (_, taskId: string) => {
    if (!taskId) {
      return { success: true };
    }
    const manager = acpManagers.get(taskId);
    if (!manager) {
      return { success: true };
    }
    const result = await manager.disconnect();
    acpManagers.delete(taskId);
    return result;
  });

  ipcMain.handle("agent:stop", async (_, taskId: string) => {
    if (!taskId) {
      return { success: true };
    }
    const manager = acpManagers.get(taskId);
    if (!manager) {
      return { success: true };
    }
    return await manager.stopCurrentRequest();
  });
};
