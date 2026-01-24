import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
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

const onCreateMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    minWidth: 1000,
    height: 900,
    minHeight: 700,
    icon: path.resolve(__dirname, "../../../../assets/icons/256x256.png"),
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
