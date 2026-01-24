import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { type BrowserWindow, ipcMain } from "electron";
import { ACPClient } from "../acp/Client";
import {
  enrichPathFromLoginShell,
  getCustomNodePath,
  getNodeRuntimePreference,
  resolveActualJsEntry,
  resolveAuthCommand,
  resolveNodeRuntime,
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

let acpClient: ACPClient | null = null;
let activeConnectionKey: string | null = null;

type PackageManager = {
  kind: "npm";
  cmd: string;
  source: "system";
};

const resolvePackageManager = async (): Promise<PackageManager> => {
  getCustomNodePath();
  await enrichPathFromLoginShell();
  const systemNpm = await resolveSystemCommand("npm");
  return { kind: "npm", cmd: systemNpm || "npm", source: "system" };
};

export const registerAgentHandlers = (mainWindow: BrowserWindow | null) => {
  ipcMain.handle(
    "agent:connect",
    async (
      _,
      command: string,
      cwd?: string,
      env?: Record<string, string>,
      options?: { reuseIfSame?: boolean; createSession?: boolean },
    ) => {
      try {
        if (!acpClient) {
          acpClient = new ACPClient((msg) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("agent:message", msg);
            }
          });
        }

        const parts = command.split(" ");
        let cmd = parts[0];
        const args = parts.slice(1);
        let resolvedEnv = env;

        const localBin = getLocalAgentBin(cmd);
        if (localBin) {
          console.log(`[Main] Using local agent binary: ${localBin}`);
          if (process.platform !== "win32") {
            try {
              await fs.chmod(localBin, 0o755);
            } catch (e) {
              console.error(`[Main] Failed to chmod local bin: ${e}`);
            }
          }

          const actualEntry = await resolveActualJsEntry(localBin);
          const shouldUseNode = actualEntry?.isNodeScript ?? false;

          if (shouldUseNode) {
            const jsPath = actualEntry?.path || localBin;
            console.log(`[Main] Resolved JS entry: ${jsPath}`);
            args.unshift(shellQuote(jsPath));

            const nodeRuntime = await resolveNodeRuntime();
            cmd = shellQuote(nodeRuntime.file);
            if (nodeRuntime.env) {
              resolvedEnv = { ...(resolvedEnv || {}), ...nodeRuntime.env };
            }
            console.log(
              `[Main] Using ${nodeRuntime.source === "custom" ? "custom" : "bundled"} node runtime: ${cmd}`,
            );
          } else {
            cmd = shellQuote(localBin);
          }
        }

        const connectionKey = JSON.stringify({
          cmd,
          args,
          cwd: cwd || process.cwd(),
          env: resolvedEnv || null,
        });

        try {
          if (
            options?.reuseIfSame &&
            acpClient.isConnected() &&
            activeConnectionKey === connectionKey
          ) {
            return { success: true, reused: true, sessionId: null };
          }
          const result = await acpClient.connect(cmd, args, cwd, resolvedEnv, {
            createSession: options?.createSession ?? true,
          });
          activeConnectionKey = connectionKey;
          return {
            success: true,
            reused: false,
            sessionId: result?.sessionId ?? null,
          };
        } catch (e: any) {
          console.error("Connect error:", e);
          return { success: false, error: e.message };
        }
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
      return { installed: true, source: "bundled" };
    }

    try {
      const whichCmd = process.platform === "win32" ? "where" : "which";
      await execAsync(`${whichCmd} ${command}`);
      return { installed: true, source: "system" };
    } catch {
      return { installed: false };
    }
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
    let resolved;
    try {
      resolved = await resolveAuthCommand(command);
    } catch (e: any) {
      return { success: false, error: e.message || "Failed to resolve command" };
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

  ipcMain.handle("agent:permission-response", (_, id: string, response: any) => {
    if (acpClient) {
      acpClient.resolvePermission(id, response);
    }
  });

  ipcMain.handle("agent:send", async (_, message: string, images?: Array<{ mimeType: string; dataUrl: string }>) => {
    if (acpClient) {
      await acpClient.sendMessage(message, images);
    } else {
      throw new Error("Agent not connected");
    }
  });

  ipcMain.handle("agent:get-capabilities", async () => {
    if (!acpClient) {
      return null;
    }
    return acpClient.getCapabilities();
  });

  ipcMain.handle("agent:new-session", async (_, cwd?: string) => {
    if (!acpClient) {
      throw new Error("Agent not connected");
    }
    const sessionId = await acpClient.createSession(cwd);
    return { success: true, sessionId };
  });

  ipcMain.handle("agent:load-session", async (_, sessionId: string, cwd?: string) => {
    if (!acpClient) {
      throw new Error("Agent not connected");
    }
    await acpClient.loadSession(sessionId, cwd);
    return { success: true };
  });

  ipcMain.handle("agent:resume-session", async (_, sessionId: string, cwd?: string) => {
    if (!acpClient) {
      throw new Error("Agent not connected");
    }
    await acpClient.resumeSession(sessionId, cwd);
    return { success: true };
  });

  ipcMain.handle("agent:set-active-session", async (_, sessionId: string) => {
    if (!acpClient) {
      throw new Error("Agent not connected");
    }
    acpClient.setActiveSession(sessionId);
    return { success: true };
  });

  ipcMain.handle("agent:set-model", async (_, modelId: string) => {
    try {
      if (!acpClient) {
        throw new Error("Agent not connected");
      }
      return await acpClient.setModel(modelId);
    } catch (e: any) {
      console.error("Set model error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agent:disconnect", async () => {
    if (acpClient) {
      await acpClient.disconnect();
      acpClient = null;
      activeConnectionKey = null;
    }
    return { success: true };
  });
};
