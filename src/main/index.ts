import { existsSync } from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, protocol } from "electron";
import { initializeAcpDetector } from "./acp/AcpDetector";
import { initDB } from "./db/store";
import {
  registerAgentHandlers,
  registerDbHandlers,
  registerDialogHandlers,
  registerEnvHandlers,
} from "./ipc";

export let mainWindow: BrowserWindow | null = null;

export const isDev = !app.isPackaged;
const loadUrl: string = isDev
  ? `http://localhost:${process.env._PORT}`
  : `file://${path.resolve(__dirname, "../render/index.html")}`;

protocol.registerSchemesAsPrivileged([
  { scheme: "wallpaper", privileges: { secure: true, standard: true } },
]);

const initIpc = () => {
  ipcMain.on("ping", () => {
    dialog.showMessageBox(mainWindow!, { message: "hello" });
  });

  ipcMain.handle("app:relaunch", async () => {
    app.relaunch();
    app.exit(0);
    return { success: true };
  });

  // Register modular IPC handlers
  registerEnvHandlers(mainWindow);
  registerDialogHandlers(mainWindow);
  registerDbHandlers();
  registerAgentHandlers(mainWindow);
};

const registerWallpaperProtocol = () => {
  protocol.registerFileProtocol("wallpaper", (request, callback) => {
    try {
      const url = new URL(request.url);
      const encodedPath = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
      const decodedPath = decodeURIComponent(encodedPath);
      if (!decodedPath) {
        callback({ error: -6 });
        return;
      }
      const normalizedPath = path.normalize(decodedPath);
      if (path.isAbsolute(normalizedPath)) {
        callback({ path: normalizedPath });
        return;
      }

      const baseCandidates = [
        app.getAppPath(),
        path.resolve(app.getAppPath(), ".."),
        path.resolve(app.getAppPath(), "..", "render"),
        path.resolve(app.getAppPath(), "render"),
        process.resourcesPath,
        process.cwd(),
      ];
      const relativeCandidates = [normalizedPath, path.join("public", normalizedPath)];

      for (const base of baseCandidates) {
        for (const relPath of relativeCandidates) {
          const candidate = path.resolve(base, relPath);
          if (existsSync(candidate)) {
            callback({ path: candidate });
            return;
          }
        }
      }

      callback({ error: -6 });
    } catch {
      callback({ error: -324 });
    }
  });
};

const onCreateMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    minWidth: 1000,
    height: 900,
    minHeight: 700,
    icon: path.resolve(__dirname, "../../../../assets/icons/256x256.png"),
    // 配置窗口样式 - 隐藏默认标题栏，使用自定义标题栏
    titleBarStyle: "hiddenInset", // Mac OS 隐藏标题栏但保留 traffic lights（红绿灯按钮）
    titleBarOverlay: {
      // Windows/Linux 标题栏覆盖层样式
      color: "#ffffff",
      symbolColor: "#000000",
      height: 30,
    },
    // 禁用窗口框架（可选，完全自定义标题栏）
    // frame: false,
    webPreferences: {
      devTools: true, // 始终启用开发者工具
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.resolve(__dirname, "./preload.js"),
    },
  });
  mainWindow.loadURL(loadUrl);

  // 打开开发者工具（可选，默认关闭）
  // mainWindow.webContents.openDevTools();

  // 添加快捷键打开开发者工具（Ctrl+Shift+I）
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === "i") {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
};

app.on("ready", async () => {
  initDB();
  registerWallpaperProtocol();
  onCreateMainWindow();
  initIpc();
  await initializeAcpDetector();
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
