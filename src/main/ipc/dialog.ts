import { type BrowserWindow, dialog, ipcMain } from "electron";

export const registerDialogHandlers = (mainWindow: BrowserWindow | null) => {
  ipcMain.handle(
    "dialog:openFile",
    async (
      _,
      options?: {
        title?: string;
        filters?: { name: string; extensions: string[] }[];
      },
    ) => {
      if (!mainWindow) return null;
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: options?.title || "Select File",
        properties: ["openFile"],
        filters: options?.filters,
      });
      if (canceled || filePaths.length === 0) {
        return null;
      }
      return filePaths[0];
    },
  );

  ipcMain.handle("dialog:openFolder", async () => {
    if (!mainWindow) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
  });
};
