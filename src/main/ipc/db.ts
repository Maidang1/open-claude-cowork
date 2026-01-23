import { ipcMain } from "electron";
import {
  getSetting,
  setSetting,
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} from "../db/store";

export const registerDbHandlers = () => {
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
    setSetting("active_task_id", taskId || "");
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
};
