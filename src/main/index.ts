import { app, BrowserWindow, dialog, ipcMain, shell, clipboard } from "electron";
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

// Shell-safe path quoting for execAsync
const shellQuote = (p: string) => {
  if (process.platform === "win32") {
    // Windows cmd.exe uses double quotes
    return `"${p.replace(/"/g, '""')}"`;
  }
  // Unix shells: single quotes are safest (no variable expansion)
  return `'${p.replace(/'/g, "'\\''")}'`;
};

// Get custom node path from settings (for offline/manual configuration)
const getCustomNodePath = (): string | null => {
  try {
    const customPath = getSetting("custom_node_path");
    if (customPath && existsSync(customPath)) {
      return customPath;
    }
  } catch {
    // ignore
  }
  return null;
};

// Resolve Node.js path - prefer custom, then system
const resolveNodePath = async (): Promise<string> => {
  // 1. Check custom path first
  const customPath = getCustomNodePath();
  if (customPath) {
    return customPath;
  }

  // 2. Use system node
  return "node";
};

// Resolve npm path - use system npm
const resolveNpmPath = async (): Promise<string> => {
  return "npm";
};

const getAgentsDir = () => path.join(app.getPath("userData"), "agents");

const getLocalAgentBin = (command: string) => {
  const agentsDir = getAgentsDir();
  const binPath = path.join(agentsDir, "node_modules", ".bin", command);
  return existsSync(binPath) ? binPath : null;
};

// Resolve the actual JS entry point from a .bin symlink/wrapper
const resolveActualJsEntry = async (binPath: string): Promise<string | null> => {
  try {
    // On Unix, .bin entries are usually symlinks to the actual JS file
    const realPath = await fs.realpath(binPath);
    if (realPath.endsWith(".js")) {
      return realPath;
    }
    // If it's not a JS file directly, read it to find the target
    // (some packages use shell wrappers)
    const content = await fs.readFile(binPath, "utf-8");
    // Check if it's a Node.js shebang script
    if (content.startsWith("#!/usr/bin/env node") || content.startsWith("#!/usr/bin/node")) {
      return binPath; // It's a valid Node.js script
    }
    // For shell wrappers, the symlink resolution should have worked
    return realPath;
  } catch (e) {
    console.warn(`[Main] Failed to resolve actual JS entry for ${binPath}:`, e);
    return null;
  }
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

  // Resolve the actual JS entry point
  const actualJsPath = await resolveActualJsEntry(localBin);
  const isJsAgent = actualJsPath && actualJsPath.endsWith(".js");

  if (isJsAgent || cmdName === "qwen") {
    // Use node to run JS files
    const nodePath = await resolveNodePath();
    // Use the resolved actual JS path
    const jsPath = actualJsPath || localBin;
    return {
      file: nodePath,
      args: [jsPath, ...cmdArgs],
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
  if (process.platform === "win32") {
    // Windows cmd.exe: escape double quotes by doubling them
    return `"${value.replace(/"/g, '""')}"`;
  }
  // Unix: escape special characters
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

  // Environment check IPC handlers
  ipcMain.handle("env:check", async () => {
    const result = {
      node: { installed: false, version: null as string | null, path: null as string | null },
      npm: { installed: false, version: null as string | null },
      platform: process.platform,
      arch: process.arch,
    };

    // Check custom path first
    const customNodePath = getCustomNodePath();
    
    try {
      // Check Node.js
      const nodeCmd = customNodePath ? shellQuote(customNodePath) : "node";
      const { stdout: nodeVersion } = await execAsync(`${nodeCmd} --version`);
      result.node.installed = true;
      result.node.version = nodeVersion.trim();
      
      // Get node path
      if (customNodePath) {
        result.node.path = customNodePath;
      } else {
        try {
          const whichCmd = process.platform === "win32" ? "where" : "which";
          const { stdout: nodePath } = await execAsync(`${whichCmd} node`);
          result.node.path = nodePath.trim().split("\n")[0];
        } catch {
          // ignore
        }
      }
    } catch {
      // Node not found
    }

    try {
      // Check npm
      const { stdout: npmVersion } = await execAsync("npm --version");
      result.npm.installed = true;
      result.npm.version = npmVersion.trim();
    } catch {
      // npm not found
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
    setSetting("custom_node_path", nodePath);
    return { success: true };
  });

  ipcMain.handle("env:get-custom-node-path", async () => {
    return getCustomNodePath();
  });

  // Run installation command for Node.js setup
  ipcMain.handle("env:run-install-command", async (_, command: string) => {
    console.log(`[Install] Running command: ${command}`);
    
    try {
      // Different shell handling for different platforms
      let shellCmd: string;
      let shellArgs: string[];
      
      if (process.platform === "win32") {
        // On Windows, use PowerShell for better compatibility
        shellCmd = "powershell.exe";
        shellArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command];
      } else {
        // On Unix, use bash with login shell to get proper PATH
        // Source nvm if available
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
        
        // Timeout after 5 minutes
        setTimeout(() => {
          child.kill();
          reject(new Error("Installation timed out after 5 minutes"));
        }, 5 * 60 * 1000);
      });
    } catch (e: any) {
      console.error(`[Install] Error:`, e);
      throw e;
    }
  });

  ipcMain.handle("dialog:openFile", async (_, options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: options?.title || "Select File",
      properties: ["openFile"],
      filters: options?.filters,
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
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
        // Ensure execution permission for local binary (Unix only)
        if (process.platform !== "win32") {
          try {
            await fs.chmod(localBin, 0o755);
          } catch (e) {
            console.error(`[Main] Failed to chmod local bin: ${e}`);
          }
        }

        // Resolve the actual JS entry point (the .bin entry might be a shell wrapper or symlink)
        const actualJsPath = await resolveActualJsEntry(localBin);
        const isJsAgent = actualJsPath && actualJsPath.endsWith(".js");

        // Special handling for node scripts (like qwen which is a symlink to cli.js)
        // Use node to run JS files
        if (isJsAgent || cmd === "qwen") {
          // Use the resolved actual JS path, fallback to localBin
          const jsPath = actualJsPath || localBin;
          console.log(`[Main] Resolved JS entry: ${jsPath}`);
          
          // Quote the path because Client.ts uses { shell: true } which requires manual quoting for paths with spaces
          args.unshift(shellQuote(jsPath));

          // Use system node (or custom path)
          const nodePath = await resolveNodePath();
          const customNodePath = getCustomNodePath();
          if (customNodePath) {
            cmd = shellQuote(customNodePath);
            console.log(`[Main] Using custom node path: ${cmd}`);
          } else {
            cmd = nodePath;
            console.log(`[Main] Using system node: ${cmd}`);
          }
        } else {
          cmd = shellQuote(localBin);
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

    // 2. Check custom node path
    if (command === "node") {
      const customNodePath = getCustomNodePath();
      if (customNodePath) {
        return { installed: true, source: "custom" };
      }
    }

    // 3. Check system PATH
    try {
      const whichCmd = process.platform === "win32" ? "where" : "which";
      await execAsync(`${whichCmd} ${command}`);
      return { installed: true, source: "system" };
    } catch {
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
        await fs.writeFile(path.join(agentsDir, "package.json"), '{"name": "agents", "version": "1.0.0"}', "utf-8");
      }

      const pkgName = extractPackageName(packageName);
      const latestSpecifier = toLatestSpecifier(packageName);

      // Remove previously installed version
      if (pkgName) {
        try {
          await execAsync(`npm uninstall ${pkgName}`, { cwd: agentsDir });
        } catch (uninstallErr) {
          console.warn(
            `[Main] npm uninstall ${pkgName} failed (likely not installed): ${uninstallErr}`,
          );
        }
      }

      // Install using npm
      console.log(`[Main] Installing ${latestSpecifier} to ${agentsDir}...`);
      await execAsync(`npm install ${latestSpecifier}`, { cwd: agentsDir });
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
