import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export type SandboxConfig = {
  allowedPaths: string[];
  sensitivePaths: string[];
  requirePermission: boolean;
  maxFileSize: number;
};

const DEFAULT_SENSITIVE_PATHS: string[] = [
  "/etc/passwd",
  "/etc/shadow",
  "/etc/hosts",
  "/etc/ssh",
  "/root",
  "/var",
  "/sys",
  "/proc",
];

export class SensitivePathValidator {
  private sensitivePaths: Set<string>;

  constructor(sensitivePaths: string[] = DEFAULT_SENSITIVE_PATHS) {
    this.sensitivePaths = new Set(sensitivePaths.map((p) => this.expandPath(p).toLowerCase()));
  }

  private expandPath(p: string): string {
    if (p.startsWith("~")) {
      return path.join(os.homedir(), p.slice(1));
    }
    return p;
  }

  isSensitive(targetPath: string): boolean {
    const expanded = this.expandPath(targetPath).toLowerCase();
    const normalized = path.normalize(expanded);

    for (const sensitive of this.sensitivePaths) {
      if (normalized.startsWith(sensitive) || normalized === sensitive) {
        return true;
      }
    }

    return false;
  }
}

export function createDefaultSandboxConfig(workspace: string): SandboxConfig {
  const homeDir = os.homedir();
  return {
    allowedPaths: [workspace],
    sensitivePaths: [
      ...DEFAULT_SENSITIVE_PATHS,
      path.join(homeDir, ".ssh"),
      path.join(homeDir, ".aws"),
      path.join(homeDir, ".gnupg"),
      path.join(homeDir, ".config", "ssh"),
    ],
    requirePermission: true,
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
  };
}

export function validatePath(
  targetPath: string,
  config: SandboxConfig,
): { allowed: boolean; reason?: string } {
  const normalized = path.normalize(targetPath);

  const validator = new SensitivePathValidator(config.sensitivePaths);
  if (validator.isSensitive(normalized)) {
    return {
      allowed: false,
      reason: `Path is in sensitive path blacklist: ${targetPath}`,
    };
  }

  const isAllowed = config.allowedPaths.some((allowed) => {
    const normalizedAllowed = path.normalize(allowed);
    return normalized.startsWith(normalizedAllowed) || normalized === normalizedAllowed;
  });

  if (!isAllowed) {
    return {
      allowed: false,
      reason: `Path is outside allowed workspace: ${targetPath}`,
    };
  }

  return { allowed: true };
}

export function validateFileSize(
  filePath: string,
  maxSize: number,
): { allowed: boolean; reason?: string; size?: number } {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > maxSize) {
      return {
        allowed: false,
        reason: `File size exceeds limit: ${stats.size} bytes (max: ${maxSize} bytes)`,
        size: stats.size,
      };
    }
    return { allowed: true, size: stats.size };
  } catch (error) {
    return {
      allowed: false,
      reason: `Failed to check file size: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function isDirectoryTraversalAttempt(targetPath: string, basePath: string): boolean {
  const normalizedTarget = path.normalize(targetPath);
  const normalizedBase = path.normalize(basePath);

  const relative = path.relative(normalizedBase, normalizedTarget);
  return relative.startsWith("..");
}
