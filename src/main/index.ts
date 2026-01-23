import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { initDB } from "./db/store";
import {
  registerEnvHandlers,
  registerDialogHandlers,
  registerDbHandlers,
  registerAgentHandlers,
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
  onCreateMainWindow();
  initIpc();
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
