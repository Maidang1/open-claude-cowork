import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getAppDataDir } from "./app-paths";

const execAsync = promisify(exec);

// Shell-safe path quoting for execAsync
export const shellQuote = (p: string) => {
  if (process.platform === "win32") {
    return `"${p.replace(/"/g, '""')}"`;
  }
  return `'${p.replace(/'/g, "'\\''")}'`;
};

export const quoteForShell = (value: string) => {
  if (!value) return '""';
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
};

export const buildCommandString = (file: string, args: string[]) => {
  return [file, ...args].map(quoteForShell).join(" ");
};

export const buildEnvPrefix = (env?: Record<string, string>) => {
  if (!env || Object.keys(env).length === 0) return "";
  if (process.platform === "win32") {
    return `${Object.entries(env)
      .map(([key, value]) => `set "${key}=${value}"`)
      .join(" && ")} && `;
  }
  return `${Object.entries(env)
    .map(([key, value]) => `${key}=${quoteForShell(value)}`)
    .join(" ")} `;
};

// Parse command line with proper quote handling
export const parseCommandLine = (input: string) => {
  const args: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
      } else {
        current += char;
      }
    } else {
      if (char === "'" || char === '"') {
        quote = char;
      } else if (/\s/.test(char)) {
        if (current) {
          args.push(current);
          current = "";
        }
      } else if (char === "\\" && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
      } else {
        current += char;
      }
    }
  }

  if (current) args.push(current);
  return args;
};

// Package name extraction from specifier
export const extractPackageName = (specifier: string) => {
  const trimmed = specifier.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith("@")) {
    const secondAt = trimmed.indexOf("@", 1);
    return secondAt === -1 ? trimmed : trimmed.slice(0, secondAt);
  }

  const lastAt = trimmed.lastIndexOf("@");
  return lastAt > 0 ? trimmed.slice(0, lastAt) : trimmed;
};

export const toLatestSpecifier = (specifier: string) => {
  const pkgName = extractPackageName(specifier);
  return pkgName ? `${pkgName}@latest` : specifier;
};

// Agents directory management
export const getAgentsDir = () => path.join(getAppDataDir(), "agents");

export const getLocalAgentBin = (command: string) => {
  const agentsDir = getAgentsDir();
  const binPath = path.join(agentsDir, "node_modules", ".bin", command);

  if (existsSync(binPath)) return binPath;

  if (process.platform === "win32") {
    const cmdPath = `${binPath}.cmd`;
    if (existsSync(cmdPath)) return cmdPath;
    const ps1Path = `${binPath}.ps1`;
    if (existsSync(ps1Path)) return ps1Path;
  }

  return null;
};

export const readInstalledPackageVersion = async (packageName: string) => {
  const parts = packageName.split("/").filter(Boolean);
  const pkgJsonPath = path.join(getAgentsDir(), "node_modules", ...parts, "package.json");
  try {
    const data = await fs.readFile(pkgJsonPath, "utf-8");
    const parsed = JSON.parse(data);
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
};

// System command resolution
export const resolveSystemCommand = async (command: string): Promise<string | null> => {
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = await execAsync(`${whichCmd} ${command}`);
    const resolved = stdout.trim().split(/\r?\n/)[0];
    return resolved || null;
  } catch {
    return null;
  }
};

// Run command in login shell
export const runInLoginShell = async (command: string) => {
  const defaultShell = process.platform === "darwin" ? "/bin/zsh" : "/bin/bash";
  const shellPath = process.env.SHELL || defaultShell;
  const isZsh = shellPath.endsWith("zsh");
  const flags = isZsh ? "-lic" : "-lc";
  return execAsync(`${shellPath} ${flags} '${command.replace(/'/g, "'\\''")}'`);
};
