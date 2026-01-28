import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { AcpAgentManager } from "../main/acp/AcpAgentManager";
import { acpDetector } from "../main/acp/AcpDetector";
import {
  createTask,
  deleteTask,
  getSetting,
  getTask,
  listTasks,
  setSetting,
  updateTask,
} from "../main/db/store";
import {
  enrichPathFromLoginShell,
  getCustomNodePath,
  getNodeRuntimePreference,
  normalizeNodeRuntimePreference,
  resolveAuthCommand,
  resolveNodeRuntime,
  setNodeRuntimePreference,
} from "../main/utils/node-runtime";
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
} from "../main/utils/shell";
import type { JsonRpcServer } from "./server";

const execAsync = promisify(exec);

const emitEvent = (channel: string, payload: unknown) => {
  const message = JSON.stringify({ channel, payload });
  process.stdout.write(`EVENT:${message}\n`);
};

const getParam = <T>(params: unknown, index: number, key: string): T | undefined => {
  if (Array.isArray(params)) {
    return params[index] as T | undefined;
  }
  if (params && typeof params === "object") {
    const record = params as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key] as T | undefined;
    }
    if (index === 0) {
      return params as T;
    }
    return undefined;
  }
  if (index === 0) {
    return params as T;
  }
  return undefined;
};

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

export const registerAllHandlers = (server: JsonRpcServer) => {
  // ========== Database Handlers ==========
  server.register("db:get-last-workspace", async () => getSetting("last_workspace"));
  server.register("db:set-last-workspace", async (params) => {
    const workspace = getParam<string>(params, 0, "workspace") || "";
    setSetting("last_workspace", workspace);
    return { success: true };
  });
  server.register("db:get-active-task", async () => getSetting("active_task_id"));
  server.register("db:set-active-task", async (params) => {
    const taskId = getParam<string | null>(params, 0, "taskId");
    setSetting("active_task_id", taskId || "");
    return { success: true };
  });
  server.register("db:list-tasks", async () => listTasks());
  server.register("db:get-task", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId") || "";
    return getTask(taskId);
  });
  server.register("db:create-task", async (params) => {
    const task = getParam<any>(params, 0, "task");
    createTask(task);
    return { success: true };
  });
  server.register("db:update-task", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId") || "";
    const updates = getParam<any>(params, 1, "updates") || {};
    updateTask(taskId, updates);
    return { success: true };
  });
  server.register("db:delete-task", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId") || "";
    deleteTask(taskId);
    return { success: true };
  });

  // ========== Agent Handlers ==========
  server.register("agent:connect", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    const command = getParam<string>(params, 1, "command") || "";
    const cwd = getParam<string | undefined>(params, 2, "cwd");
    const env = getParam<Record<string, string> | undefined>(params, 3, "env");
    const options = getParam<
      { reuseIfSame?: boolean; createSession?: boolean } | undefined
    >(params, 4, "options");

    if (!taskId) {
      return { success: false, error: "Task id is required" };
    }

    let manager = acpManagers.get(taskId);
    if (!manager) {
      manager = new AcpAgentManager((msg) => {
        if (typeof msg === "string") {
          emitEvent("agent:message", { type: "agent_text", text: msg, taskId });
          return;
        }
        emitEvent("agent:message", { ...msg, taskId });
      });
      acpManagers.set(taskId, manager);
    }

    try {
      return await manager.connect(command, cwd, env, options);
    } catch (e: any) {
      console.error("Connect error:", e);
      return { success: false, error: e?.message || "Connection failed" };
    }
  });

  server.register("agent:check-command", async (params) => {
    const command = getParam<string>(params, 0, "command") || "";
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

  server.register("agent:get-available-agents", async () => acpDetector.getAvailableAgents());
  server.register("agent:detect-cli-path", async (params) => {
    const command = getParam<string>(params, 0, "command") || "";
    return acpDetector.detectCliPath(command);
  });
  server.register("agent:get-package-version", async (params) => {
    const packageName = getParam<string>(params, 0, "packageName") || "";
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
      return { success: false, error: e?.message };
    }
  });
  server.register("agent:install", async (params) => {
    const packageName = getParam<string>(params, 0, "packageName") || "";
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
            `[Sidecar] package remove ${pkgName} failed (likely not installed): ${uninstallErr}`,
          );
        }
      }

      console.log(
        `[Sidecar] Installing ${latestSpecifier} to ${agentsDir} using ${pm.kind} (${pm.source})...`,
      );
      const installCmd = `${pmCmd} install ${latestSpecifier}`;
      await execAsync(installCmd, { cwd: agentsDir });
      return { success: true };
    } catch (e: any) {
      console.error("Install error:", e);
      return { success: false, error: e?.message };
    }
  });
  server.register("agent:uninstall", async (params) => {
    const packageName = getParam<string>(params, 0, "packageName") || "";
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
        `[Sidecar] Uninstalling ${pkgName} from ${agentsDir} using ${pm.kind} (${pm.source})...`,
      );
      const removeCmd = `${pmCmd} uninstall ${pkgName}`;
      await execAsync(removeCmd, { cwd: agentsDir });
      return { success: true };
    } catch (e: any) {
      console.error("Uninstall error:", e);
      return { success: false, error: e?.message };
    }
  });

  server.register("agent:auth-terminal", async (params) => {
    const command = getParam<string>(params, 0, "command") || "";
    const cwd = getParam<string | undefined>(params, 1, "cwd");

    let resolved: Awaited<ReturnType<typeof resolveAuthCommand>> | null = null;
    try {
      resolved = await resolveAuthCommand(command);
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Failed to resolve command",
      };
    }
    if (!resolved) {
      return { success: false, error: "Invalid command" };
    }

    const targetCmd = buildCommandString(resolved.file, resolved.args);
    const envPrefix = buildEnvPrefix(resolved.env);
    const targetWithEnv = envPrefix ? `${envPrefix}${targetCmd}` : targetCmd;

    console.log(
      `[Sidecar] Launching auth terminal for: ${targetWithEnv} in ${cwd || "default cwd"}`,
    );

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
      return { success: false, error: e?.message };
    }
  });

  server.register("agent:permission-response", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    const id = getParam<string>(params, 1, "id") || "";
    const response = getParam<unknown>(params, 2, "response");
    try {
      const manager = getAcpManager(taskId);
      manager.resolvePermission(id, response);
      return { success: true };
    } catch (e: any) {
      console.warn("Permission response error:", e?.message || e);
      return { success: false };
    }
  });

  server.register("agent:send", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    const message = getParam<string>(params, 1, "message") || "";
    const images = getParam<Array<{ mimeType: string; dataUrl: string }> | undefined>(
      params,
      2,
      "images",
    );
    const manager = getAcpManager(taskId);
    await manager.sendMessage(message, images);
    return { success: true };
  });

  server.register("agent:get-capabilities", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    const manager = getAcpManager(taskId);
    return manager.getCapabilities() ?? null;
  });

  server.register("agent:new-session", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    const cwd = getParam<string | undefined>(params, 1, "cwd");
    const mcpServers = getParam<unknown[] | undefined>(params, 2, "mcpServers");
    const manager = getAcpManager(taskId);
    return await manager.createSession(cwd, mcpServers);
  });

  server.register("agent:load-session", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    const sessionId = getParam<string>(params, 1, "sessionId") || "";
    const cwd = getParam<string | undefined>(params, 2, "cwd");
    const mcpServers = getParam<unknown[] | undefined>(params, 3, "mcpServers");
    const manager = getAcpManager(taskId);
    return await manager.loadSession(sessionId, cwd, mcpServers);
  });

  server.register("agent:resume-session", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    const sessionId = getParam<string>(params, 1, "sessionId") || "";
    const cwd = getParam<string | undefined>(params, 2, "cwd");
    const mcpServers = getParam<unknown[] | undefined>(params, 3, "mcpServers");
    const manager = getAcpManager(taskId);
    return await manager.resumeSession(sessionId, cwd, mcpServers);
  });

  server.register("agent:set-active-session", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    const sessionId = getParam<string>(params, 1, "sessionId") || "";
    const cwd = getParam<string | undefined>(params, 2, "cwd");
    const manager = getAcpManager(taskId);
    return await manager.setActiveSession(sessionId, cwd);
  });

  server.register("agent:set-model", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    const modelId = getParam<string>(params, 1, "modelId") || "";
    try {
      const manager = getAcpManager(taskId);
      return await manager.setModel(modelId);
    } catch (e: any) {
      console.error("Set model error:", e);
      return { success: false, error: e?.message };
    }
  });

  server.register("agent:disconnect", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
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

  server.register("agent:stop", async (params) => {
    const taskId = getParam<string>(params, 0, "taskId");
    if (!taskId) {
      return { success: true };
    }
    const manager = acpManagers.get(taskId);
    if (!manager) {
      return { success: true };
    }
    return await manager.stopCurrentRequest();
  });

  // ========== Environment Handlers ==========
  server.register("env:check", async () => {
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

  server.register("env:validate-node-path", async (params) => {
    const nodePath = getParam<string>(params, 0, "nodePath") || "";
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
      return { valid: false, error: e?.message || "Failed to execute" };
    }
  });

  server.register("env:set-custom-node-path", async (params) => {
    const nodePath = getParam<string>(params, 0, "nodePath") || "";
    if (!nodePath) {
      setSetting("custom_node_path", "");
      setSetting("node_runtime_preference", "system");
    } else {
      setSetting("custom_node_path", nodePath);
      setSetting("node_runtime_preference", "custom");
    }
    return { success: true };
  });

  server.register("env:get-custom-node-path", async () => getSetting("custom_node_path"));
  server.register("env:get-node-runtime", async () => getNodeRuntimePreference());
  server.register("env:set-node-runtime", async (params) => {
    const runtime = getParam<string>(params, 0, "runtime") || "";
    const normalized = normalizeNodeRuntimePreference(runtime);
    if (!normalized) {
      return { success: false, error: "Invalid runtime value" };
    }
    setNodeRuntimePreference(normalized);
    return { success: true };
  });

  server.register("env:get-wallpaper", async () => getSetting("wallpaper_path"));
  server.register("env:set-wallpaper", async (params) => {
    const wallpaperPath = getParam<string>(params, 0, "wallpaperPath") || "";
    setSetting("wallpaper_path", wallpaperPath);
    return { success: true };
  });
  server.register("env:clear-wallpaper", async () => {
    setSetting("wallpaper_path", "");
    return { success: true };
  });

  server.register("env:run-install-command", async (params) => {
    const command = getParam<string>(params, 0, "command") || "";
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
