import { ipcMain } from "electron";
import {
  createCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  purgeTaskCheckpoints,
  rollbackCheckpoint,
} from "../utils/checkpoints";

export const registerCheckpointHandlers = () => {
  ipcMain.handle(
    "checkpoint:create",
    async (_, taskId: string, workspaceRoot: string, reason: "auto" | "manual" | "pre-write") => {
      try {
        const checkpointId = await createCheckpoint(taskId, workspaceRoot, reason);
        return { success: true, checkpointId };
      } catch (e: any) {
        console.error("Checkpoint create error:", e);
        return { success: false, error: e.message };
      }
    },
  );

  ipcMain.handle("checkpoint:list", async (_, taskId: string) => {
    try {
      const checkpoints = await listCheckpoints(taskId);
      return { success: true, checkpoints };
    } catch (e: any) {
      console.error("Checkpoint list error:", e);
      return { success: false, error: e.message, checkpoints: [] };
    }
  });

  ipcMain.handle(
    "checkpoint:rollback",
    async (
      _,
      taskId: string,
      workspaceRoot: string,
      checkpointId: string,
      options?: { mode?: "force" | "skip" },
    ) => {
      try {
        const mode = options?.mode === "skip" ? "skip" : "force";
        const result = await rollbackCheckpoint(taskId, workspaceRoot, checkpointId, mode);
        return { success: true, ...result };
      } catch (e: any) {
        console.error("Checkpoint rollback error:", e);
        return { success: false, error: e.message };
      }
    },
  );

  ipcMain.handle("checkpoint:delete", async (_, taskId: string, checkpointId: string) => {
    try {
      await deleteCheckpoint(taskId, checkpointId);
      return { success: true };
    } catch (e: any) {
      console.error("Checkpoint delete error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("checkpoint:purge-task", async (_, taskId: string) => {
    try {
      await purgeTaskCheckpoints(taskId);
      return { success: true };
    } catch (e: any) {
      console.error("Checkpoint purge error:", e);
      return { success: false, error: e.message };
    }
  });
};
