import os from "node:os";
import path from "node:path";
import type { SandboxConfig } from "@src/types/acpTypes";
import { validatePath } from "./sandbox";

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

export const validateAndResolvePath = (
  workspace: string,
  targetPath: string,
  config: SandboxConfig,
): string => {
  const resolved = resolveWorkspacePath(workspace, targetPath);
  const validation = validatePath(resolved, config);

  if (!validation.allowed) {
    throw new Error(validation.reason || "Path not allowed by sandbox");
  }

  return resolved;
};
