import path, { resolve } from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ACPClient } from "./acp/Client";

export let mainWindow: BrowserWindow | null = null;
let acpClient: ACPClient | null = null;

export const isDev = !app.isPackaged;
const loadUrl: string = isDev
  ? `http://localhost:${process.env._PORT}`
  : `file://${path.resolve(__dirname, "../render/index.html")}`;

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

  // ACP IPC Handlers
  ipcMain.handle("agent:connect", async (_, command: string, cwd?: string) => {
    if (!acpClient) {
      acpClient = new ACPClient((msg) => {
        // Forward agent messages to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("agent:message", msg);
        }
      });
    }

    // Command splitting (naive)
    const [cmd, ...args] = command.split(" ");
    try {
      await acpClient.connect(cmd, args, cwd);
      return { success: true };
    } catch (e: any) {
      console.error("Connect error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agent:send", async (_, message: string) => {
    if (acpClient) {
      await acpClient.sendMessage(message);
    } else {
      throw new Error("Agent not connected");
    }
  });

  ipcMain.handle("agent:disconnect", () => {
    if (acpClient) {
      acpClient.disconnect();
      acpClient = null;
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
    icon: resolve(__dirname, "../../../../assets/icons/256x256.png"),
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
