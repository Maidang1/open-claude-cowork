import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ACPClient } from "./acp/Client";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  initDB,
  setSetting,
  getSetting,
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} from "./db/store";

const execAsync = promisify(exec);

export let mainWindow: BrowserWindow | null = null;
let acpClient: ACPClient | null = null;
let activeConnectionKey: string | null = null;

export const isDev = !app.isPackaged;
const loadUrl: string = isDev
  ? `http://localhost:${process.env._PORT}`
  : `file://${path.resolve(__dirname, "../render/index.html")}`;

const NODE_BIN_NAME = process.platform === "win32" ? "node.exe" : "node";
const resolveBundledNodePath = () => {
  const packagedPath = path.join(process.resourcesPath, "node_bin", NODE_BIN_NAME);
  if (existsSync(packagedPath)) {
    return packagedPath;
  }
  const devPath = path.resolve(
    __dirname,
    "../../../resources/node_bin",
    NODE_BIN_NAME,
  );
  if (existsSync(devPath)) {
    return devPath;
  }
  return null;
};

const getAgentsDir = () => path.join(app.getPath("userData"), "agents");

const getLocalAgentBin = (command: string) => {
  const agentsDir = getAgentsDir();
  const binPath = path.join(agentsDir, "node_modules", ".bin", command);
  return existsSync(binPath) ? binPath : null;
};

const getPackageJsonPath = (packageName: string) => {
  const parts = packageName.split("/").filter(Boolean);
  return path.join(getAgentsDir(), "node_modules", ...parts, "package.json");
};

const readInstalledPackageVersion = async (packageName: string) => {
  try {
    const pkgJsonPath = getPackageJsonPath(packageName);
    const data = await fs.readFile(pkgJsonPath, "utf-8");
    const parsed = JSON.parse(data);
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
};

const extractPackageName = (specifier: string) => {
  const trimmed = specifier.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("@")) {
    const secondAt = trimmed.indexOf("@", 1);
    return secondAt === -1 ? trimmed : trimmed.slice(0, secondAt);
  }

  const lastAt = trimmed.lastIndexOf("@");
  return lastAt > 0 ? trimmed.slice(0, lastAt) : trimmed;
};

const toLatestSpecifier = (specifier: string) => {
  const pkgName = extractPackageName(specifier);
  return pkgName ? `${pkgName}@latest` : specifier;
};

const parseCommandLine = (input: string) => {
  const args: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
      } else {
        current += char;
      }
    } else {
      if (char === "'" || char === '"') {
        quote = char;
      } else if (/\s/.test(char)) {
        if (current) {
          args.push(current);
          current = "";
        }
      } else if (char === "\\" && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
      } else {
        current += char;
      }
    }
  }

  if (current) args.push(current);
  return args;
};

const resolveAuthCommand = async (command: string) => {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const [cmdName, ...cmdArgs] = parseCommandLine(trimmed);
  if (!cmdName) return null;

  const localBin = getLocalAgentBin(cmdName);
  if (!localBin) {
    return {
      file: cmdName,
      args: cmdArgs,
    };
  }

  if (localBin.endsWith(".js") || cmdName === "qwen") {
    let nodePath = "node";
    try {
      const { stdout } = await execAsync("which node");
      nodePath = stdout.trim();
    } catch {
      const bundledNode = resolveBundledNodePath();
      if (bundledNode) {
        nodePath = bundledNode;
      }
    }
    return {
      file: nodePath,
      args: [localBin, ...cmdArgs],
    };
  }

  return {
    file: localBin,
    args: cmdArgs,
  };
};

const quoteForShell = (value: string) => {
  if (!value) return '""';
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
};

const buildCommandString = (file: string, args: string[]) => {
  return [file, ...args].map(quoteForShell).join(" ");
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

  // DB IPC Handlers
  ipcMain.handle("db:get-last-workspace", () => {
    return getSetting("last_workspace");
  });

  ipcMain.handle("db:set-last-workspace", (_, workspace: string) => {
    setSetting("last_workspace", workspace);
  });

  ipcMain.handle("db:get-active-task", () => {
    return getSetting("active_task_id");
  });

  ipcMain.handle("db:set-active-task", (_, taskId: string | null) => {
    if (taskId) {
      setSetting("active_task_id", taskId);
    } else {
      setSetting("active_task_id", "");
    }
  });

  ipcMain.handle("db:list-tasks", () => {
    return listTasks();
  });

  ipcMain.handle("db:get-task", (_, taskId: string) => {
    return getTask(taskId);
  });

  ipcMain.handle("db:create-task", (_, task: any) => {
    createTask(task);
    return { success: true };
  });

  ipcMain.handle("db:update-task", (_, taskId: string, updates: any) => {
    updateTask(taskId, updates);
    return { success: true };
  });

  ipcMain.handle("db:delete-task", (_, taskId: string) => {
    deleteTask(taskId);
    return { success: true };
  });

  // ACP IPC Handlers
  ipcMain.handle(
    "agent:connect",
    async (
      _,
      command: string,
      cwd?: string,
      env?: Record<string, string>,
      options?: { reuseIfSame?: boolean; createSession?: boolean },
    ) => {
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
            const bundledNode = resolveBundledNodePath();
            if (bundledNode) {
              cmd = bundledNode;
              console.log(`[Main] Using bundled node path: ${cmd}`);
            } else {
              console.warn(
                "[Main] Failed to resolve node path and no bundled node found, falling back to 'node'",
              );
              cmd = "node";
            }
          }
        } else {
          cmd = localBin;
        }
      }

      const connectionKey = JSON.stringify({
        cmd,
        args,
        cwd: cwd || process.cwd(),
        env: env || null,
      });

      try {
        if (
          options?.reuseIfSame &&
          acpClient.isConnected() &&
          activeConnectionKey === connectionKey
        ) {
          return { success: true, reused: true, sessionId: null };
        }
        const result = await acpClient.connect(cmd, args, cwd, env, {
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
            const bundledNode = resolveBundledNodePath();
            if (bundledNode) {
              return { installed: true, source: "bundled" };
            }
          }
          return { installed: false };
        }
  });

  ipcMain.handle(
    "agent:get-package-version",
    async (_, packageName: string) => {
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
    },
  );

  ipcMain.handle("agent:install", async (_, packageName: string) => {
    const agentsDir = getAgentsDir();
    try {
      // Ensure dir exists
      if (!existsSync(agentsDir)) {
        await fs.mkdir(agentsDir, { recursive: true });
        // Init package.json if needed
        await fs.writeFile(path.join(agentsDir, "package.json"), "{}", "utf-8");
      }

      const pkgName = extractPackageName(packageName);
      const latestSpecifier = toLatestSpecifier(packageName);

      // Remove previously installed version so npm cannot reuse the old lock entry
      if (pkgName) {
        try {
          await execAsync(`npm uninstall ${pkgName}`, { cwd: agentsDir });
        } catch (uninstallErr) {
          console.warn(
            `[Main] npm uninstall ${pkgName} failed (likely not installed): ${uninstallErr}`,
          );
        }
      }

      // Install
      console.log(`[Main] Installing ${latestSpecifier} to ${agentsDir}...`);
      // We rely on system npm for now, but in future could use bundled npm
      // Quote paths to handle spaces
      await execAsync(
        `npm install ${latestSpecifier} --force --prefer-online --registry https://registry.npmmirror.com`,
        {
          cwd: agentsDir,
        },
      );
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
      console.log(`[Main] Uninstalling ${pkgName} from ${agentsDir}...`);
      await execAsync(`npm uninstall ${pkgName}`, { cwd: agentsDir });
      return { success: true };
    } catch (e: any) {
      console.error("Uninstall error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(
    "agent:auth-terminal",
    async (_, command: string, cwd?: string) => {
      const resolved = await resolveAuthCommand(command);
      if (!resolved) {
        return { success: false, error: "Invalid command" };
      }

      const targetCmd = buildCommandString(resolved.file, resolved.args);

      console.log(
        `[Main] Launching auth terminal for: ${targetCmd} in ${cwd || "default cwd"}`,
      );

      try {
        if (process.platform === "darwin") {
          // macOS: Open Terminal
          // If cwd is provided, cd to it first
          const cdPrefix = cwd ? `cd ${JSON.stringify(cwd)} && ` : "";
          const script = `${cdPrefix}${targetCmd}`.trim();
          const escapedScript = script
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"');

          await execAsync(
            `osascript -e 'tell application "Terminal" to do script "${escapedScript}"'`,
          );
          await execAsync(
            `osascript -e 'tell application "Terminal" to activate'`,
          );
        } else if (process.platform === "win32") {
          // Windows: Start cmd
          const options = cwd ? { cwd } : {};
          await execAsync(`start cmd /k "${targetCmd}"`, options);
        } else {
          // Linux: Try x-terminal-emulator or gnome-terminal
          const cdCmd = cwd ? `cd "${cwd}" && ` : "";
          await execAsync(
            `x-terminal-emulator -e "bash -c '${cdCmd}${targetCmd}; exec bash'" || gnome-terminal -- bash -c "${cdCmd}${targetCmd}; exec bash"`,
          );
        }
        return { success: true };
      } catch (e: any) {
        console.error("Auth terminal error:", e);
        return { success: false, error: e.message };
      }
    },
  );

  ipcMain.handle(
    "agent:permission-response",
    (_, id: string, response: any) => {
      if (acpClient) {
        acpClient.resolvePermission(id, response);
      }
    },
  );

  ipcMain.handle("agent:send", async (_, message: string) => {
    if (acpClient) {
      await acpClient.sendMessage(message);
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

  ipcMain.handle(
    "agent:load-session",
    async (_, sessionId: string, cwd?: string) => {
      if (!acpClient) {
        throw new Error("Agent not connected");
      }
      await acpClient.loadSession(sessionId, cwd);
      return { success: true };
    },
  );

  ipcMain.handle(
    "agent:resume-session",
    async (_, sessionId: string, cwd?: string) => {
      if (!acpClient) {
        throw new Error("Agent not connected");
      }
      await acpClient.resumeSession(sessionId, cwd);
      return { success: true };
    },
  );

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

const onCreateMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    minWidth: 1000,
    height: 900,
    minHeight: 700,
    icon: path.resolve(__dirname, "../../../../assets/icons/256x256.png"),
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
  initDB();
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
