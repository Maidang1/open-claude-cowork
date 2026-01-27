import { type BrowserWindow, ipcMain } from "electron";
import log from "electron-log";
import { autoUpdater } from "electron-updater";

// Configure logging
autoUpdater.logger = log;
(autoUpdater.logger as any).transports.file.level = "info";

// Disable auto downloading if needed (default is true)
// autoUpdater.autoDownload = false;

export const registerUpdaterHandlers = (mainWindow: BrowserWindow | null) => {
  if (!mainWindow) return;

  // Send events to renderer
  const sendStatusToWindow = (text: string) => {
    log.info(text);
    // Optional: send raw text logs to UI if needed
    // mainWindow.webContents.send("updater:message", text);
  };

  autoUpdater.on("checking-for-update", () => {
    sendStatusToWindow("Checking for update...");
    mainWindow.webContents.send("updater:checking");
  });

  autoUpdater.on("update-available", (info) => {
    sendStatusToWindow("Update available.");
    mainWindow.webContents.send("updater:available", info);
  });

  autoUpdater.on("update-not-available", (info) => {
    sendStatusToWindow("Update not available.");
    mainWindow.webContents.send("updater:not-available", info);
  });

  autoUpdater.on("error", (err) => {
    sendStatusToWindow("Error in auto-updater. " + err);
    mainWindow.webContents.send("updater:error", err.toString());
  });

  autoUpdater.on("download-progress", (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + " - Downloaded " + progressObj.percent + "%";
    log_message = log_message + " (" + progressObj.transferred + "/" + progressObj.total + ")";
    sendStatusToWindow(log_message);
    mainWindow.webContents.send("updater:progress", progressObj);
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendStatusToWindow("Update downloaded");
    mainWindow.webContents.send("updater:downloaded", info);
  });

  // IPC handlers from Renderer
  ipcMain.handle("updater:check", () => {
    // In development, you might want to force dev update config or skip
    if (!app.isPackaged) {
      log.info("Skipping update check in dev mode");
      return { status: "dev-skipped" };
    }
    return autoUpdater.checkForUpdatesAndNotify();
  });

  ipcMain.handle("updater:quitAndInstall", () => {
    autoUpdater.quitAndInstall();
  });

  // Check for updates on startup (if packaged)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
};

import { app } from "electron";
