export type CheckpointReason = "auto" | "manual" | "pre-write";

export type CheckpointEntry = {
  checkpointId: string;
  createdAt: number;
  reason: CheckpointReason;
  fileCount: number;
};

export type CheckpointFileMeta = {
  path: string;
  size: number;
  hash: string;
  mtime: number;
};

export type CheckpointMeta = {
  taskId: string;
  checkpointId: string;
  createdAt: number;
  workspaceRoot: string;
  reason: CheckpointReason;
  files: CheckpointFileMeta[];
};

export type CheckpointIndex = {
  taskId: string;
  checkpoints: CheckpointEntry[];
};
