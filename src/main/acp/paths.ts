import os from "node:os";
import path from "node:path";

export const resolveWorkspacePath = (workspace: string, targetPath: string) => {
  const trimmed = targetPath.trim();
  if (!trimmed) {
    return path.resolve(workspace);
  }

  let normalized = trimmed;
  if (normalized.startsWith("~")) {
    normalized = path.join(os.homedir(), normalized.slice(1));
  }

  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }

  return path.resolve(workspace, normalized);
};
