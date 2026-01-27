import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  CheckpointEntry,
  CheckpointIndex,
  CheckpointMeta,
  CheckpointReason,
} from "@src/types/checkpointTypes";
import { app } from "electron";

const MAX_CHECKPOINTS_PER_TASK = 10;
const CHECKPOINT_ROOT_DIRNAME = "acp-checkpoints";
const CHECKPOINT_INDEX_FILENAME = "index.json";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".DS_Store",
  ".turbo",
  ".next",
  "dist",
  "build",
  "out",
  ".cache",
]);

type WorkspaceFile = {
  absPath: string;
  relPath: string;
};

const sanitizeId = (value: string) => value.replace(/[\\/]/g, "_");

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const readJsonFile = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJsonFile = async (filePath: string, data: unknown) => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};

const getCheckpointRoot = () => path.join(app.getPath("userData"), CHECKPOINT_ROOT_DIRNAME);

const getTaskDir = (taskId: string) => path.join(getCheckpointRoot(), sanitizeId(taskId));

const getIndexPath = (taskId: string) => path.join(getTaskDir(taskId), CHECKPOINT_INDEX_FILENAME);

const readIndex = async (taskId: string): Promise<CheckpointIndex> => {
  return await readJsonFile<CheckpointIndex>(getIndexPath(taskId), {
    taskId,
    checkpoints: [],
  });
};

const writeIndex = async (taskId: string, index: CheckpointIndex) => {
  await writeJsonFile(getIndexPath(taskId), index);
};

const hashFile = async (filePath: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("error", reject);
    stream.on("end", () => resolve(`sha256:${hash.digest("hex")}`));
  });

const isIgnoredDir = (dirName: string) => IGNORED_DIRS.has(dirName);

const isSafeRelativePath = (relativePath: string) => {
  if (!relativePath || relativePath.startsWith("..")) return false;
  if (path.isAbsolute(relativePath)) return false;
  return !relativePath.split(path.sep).some((part) => part === ".." || part === "");
};

const ensureNoSymlinkInPath = async (workspaceRoot: string, targetPath: string) => {
  const relative = path.relative(workspaceRoot, targetPath);
  if (!isSafeRelativePath(relative)) return false;
  const segments = relative.split(path.sep).filter(Boolean);
  let current = workspaceRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) {
        return false;
      }
    } catch (e: any) {
      if (e?.code === "ENOENT") {
        return true;
      }
      throw e;
    }
  }
  return true;
};

const collectWorkspaceFiles = async (workspaceRoot: string): Promise<WorkspaceFile[]> => {
  const results: WorkspaceFile[] = [];
  const pending: string[] = [workspaceRoot];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    if (!currentDir) continue;
    let entries: Array<import("node:fs").Dirent> = [];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absPath = path.join(currentDir, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        if (isIgnoredDir(entry.name)) {
          continue;
        }
        pending.push(absPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relPath = path.relative(workspaceRoot, absPath);
      if (!isSafeRelativePath(relPath)) {
        continue;
      }
      results.push({ absPath, relPath });
    }
  }

  return results;
};

const pruneIndex = async (taskId: string, index: CheckpointIndex) => {
  if (index.checkpoints.length <= MAX_CHECKPOINTS_PER_TASK) {
    return;
  }
  const sorted = [...index.checkpoints].sort((a, b) => b.createdAt - a.createdAt);
  const keep = sorted.slice(0, MAX_CHECKPOINTS_PER_TASK);
  const remove = sorted.slice(MAX_CHECKPOINTS_PER_TASK);

  index.checkpoints = keep;
  await writeIndex(taskId, index);

  await Promise.all(
    remove.map(async (entry) => {
      const target = path.join(getTaskDir(taskId), sanitizeId(entry.checkpointId));
      await fs.rm(target, { recursive: true, force: true });
    }),
  );
};

const resolveCheckpointDir = (taskId: string, checkpointId: string) =>
  path.join(getTaskDir(taskId), sanitizeId(checkpointId));

export const listCheckpoints = async (taskId: string): Promise<CheckpointEntry[]> => {
  const index = await readIndex(taskId);
  return [...index.checkpoints].sort((a, b) => b.createdAt - a.createdAt);
};

export const createCheckpoint = async (
  taskId: string,
  workspaceRoot: string,
  reason: CheckpointReason,
) => {
  const normalizedRoot = path.resolve(workspaceRoot);
  const rootStat = await fs.stat(normalizedRoot);
  if (!rootStat.isDirectory()) {
    throw new Error("Workspace root is not a directory.");
  }
  const createdAt = Date.now();
  const checkpointId = `${createdAt}-${Math.random().toString(36).slice(2, 8)}`;
  const taskDir = getTaskDir(taskId);
  const checkpointDir = resolveCheckpointDir(taskId, checkpointId);
  const filesDir = path.join(checkpointDir, "files");

  await ensureDir(taskDir);
  await ensureDir(filesDir);

  const workspaceFiles = await collectWorkspaceFiles(normalizedRoot);
  const filesMeta: CheckpointMeta["files"] = [];

  for (const file of workspaceFiles) {
    const destPath = path.join(filesDir, file.relPath);
    await ensureDir(path.dirname(destPath));
    await fs.copyFile(file.absPath, destPath);
    const [stat, hash] = await Promise.all([fs.stat(file.absPath), hashFile(file.absPath)]);
    filesMeta.push({
      path: file.relPath,
      size: stat.size,
      hash,
      mtime: stat.mtimeMs,
    });
  }

  const meta: CheckpointMeta = {
    taskId,
    checkpointId,
    createdAt,
    workspaceRoot: normalizedRoot,
    reason,
    files: filesMeta,
  };
  await writeJsonFile(path.join(checkpointDir, "meta.json"), meta);

  const index = await readIndex(taskId);
  index.checkpoints.unshift({
    checkpointId,
    createdAt,
    reason,
    fileCount: filesMeta.length,
  });
  await writeIndex(taskId, index);
  await pruneIndex(taskId, index);

  return checkpointId;
};

export const deleteCheckpoint = async (taskId: string, checkpointId: string) => {
  const index = await readIndex(taskId);
  index.checkpoints = index.checkpoints.filter((entry) => entry.checkpointId !== checkpointId);
  await writeIndex(taskId, index);
  await fs.rm(resolveCheckpointDir(taskId, checkpointId), { recursive: true, force: true });
};

export const purgeTaskCheckpoints = async (taskId: string) => {
  await fs.rm(getTaskDir(taskId), { recursive: true, force: true });
};

export const ensurePreWriteCheckpoint = async (taskId: string, workspaceRoot: string) => {
  const index = await readIndex(taskId);
  const hasPreWrite = index.checkpoints.some((entry) => entry.reason === "pre-write");
  if (hasPreWrite) {
    return null;
  }
  return await createCheckpoint(taskId, workspaceRoot, "pre-write");
};

export const rollbackCheckpoint = async (
  taskId: string,
  workspaceRoot: string,
  checkpointId: string,
  mode: "force" | "skip",
) => {
  const normalizedRoot = path.resolve(workspaceRoot);
  const checkpointDir = resolveCheckpointDir(taskId, checkpointId);
  const meta = await readJsonFile<CheckpointMeta | null>(
    path.join(checkpointDir, "meta.json"),
    null,
  );
  if (!meta) {
    throw new Error("Checkpoint metadata not found.");
  }
  if (meta.taskId !== taskId) {
    throw new Error("Checkpoint task mismatch.");
  }
  if (meta.workspaceRoot !== normalizedRoot) {
    throw new Error("Workspace root mismatch.");
  }

  let restored = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  for (const file of meta.files) {
    const targetPath = path.resolve(normalizedRoot, file.path);
    const relative = path.relative(normalizedRoot, targetPath);
    if (!isSafeRelativePath(relative)) {
      skipped += 1;
      continue;
    }
    const safePath = await ensureNoSymlinkInPath(normalizedRoot, targetPath);
    if (!safePath) {
      skipped += 1;
      continue;
    }

    let exists = false;
    try {
      await fs.stat(targetPath);
      exists = true;
    } catch (e: any) {
      if (e?.code !== "ENOENT") {
        skipped += 1;
        continue;
      }
    }

    if (exists) {
      const currentHash = await hashFile(targetPath);
      if (currentHash === file.hash) {
        skipped += 1;
        continue;
      }
      conflicts.push(file.path);
      if (mode === "skip") {
        skipped += 1;
        continue;
      }
    }

    const sourcePath = path.join(checkpointDir, "files", file.path);
    await ensureDir(path.dirname(targetPath));
    await fs.copyFile(sourcePath, targetPath);
    restored += 1;
  }

  const logPath = path.join(checkpointDir, "rollback.log");
  const logLine = `[${new Date().toISOString()}] restored=${restored} skipped=${skipped} conflicts=${conflicts.length}\n`;
  await fs.appendFile(logPath, logLine, "utf-8");

  return { restored, skipped, conflicts };
};
