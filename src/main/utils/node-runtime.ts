import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { getSetting, setSetting } from "../db/store";
import { getLocalAgentBin, parseCommandLine, resolveSystemCommand } from "./shell";

export type NodeRuntimePreference = "system" | "custom";

export type NodeRuntime = {
  file: string;
  env?: Record<string, string>;
  source: "custom" | "system";
};

export type ResolvedEntry = {
  path: string;
  isNodeScript: boolean;
};

export type ResolvedCommand = {
  file: string;
  args: string[];
  env?: Record<string, string>;
};

const NODE_RUNTIME_KEY = "node_runtime_preference";
const PATH_KEY = "PATH";

let pathEnrichedFromShell = false;
let pathEnrichmentInFlight: Promise<void> | null = null;
let lastCustomNodePathApplied: string | null = null;

export const normalizeNodeRuntimePreference = (
  value: string | null,
): NodeRuntimePreference | null => {
  if (value === "system" || value === "custom") return value;
  return null;
};

export const getNodeRuntimePreference = (): NodeRuntimePreference => {
  const stored = normalizeNodeRuntimePreference(getSetting(NODE_RUNTIME_KEY));
  const hasCustom = Boolean(getSetting("custom_node_path"));

  if (stored === "custom" && !hasCustom) {
    setSetting(NODE_RUNTIME_KEY, "system");
    return "system";
  }

  if (stored) return stored;
  return hasCustom ? "custom" : "system";
};

export const setNodeRuntimePreference = (value: NodeRuntimePreference) => {
  setSetting(NODE_RUNTIME_KEY, value);
};

const ensureCustomNodeOnPath = (nodePath: string) => {
  if (!nodePath || lastCustomNodePathApplied === nodePath) return;
  const nodeDir = path.dirname(nodePath);
  const current = process.env[PATH_KEY] || "";
  const parts = current.split(path.delimiter).filter(Boolean);
  if (!parts.includes(nodeDir)) {
    const merged = [nodeDir, ...parts].join(path.delimiter);
    (process.env as Record<string, string>)[PATH_KEY] = merged;
  }
  lastCustomNodePathApplied = nodePath;
};

export const getCustomNodePath = (): string | null => {
  try {
    const customPath = getSetting("custom_node_path");
    if (!customPath) {
      return null;
    }

    if (existsSync(customPath)) {
      ensureCustomNodeOnPath(customPath);
      return customPath;
    }

    console.warn(`[Main] Custom Node.js path ${customPath} no longer exists. Clearing setting.`);
    setSetting("custom_node_path", "");
    setSetting(NODE_RUNTIME_KEY, "system");
  } catch (e) {
    console.warn("[Main] Failed to read custom Node.js path:", e);
  }
  return null;
};

export const resolveSystemNode = async (): Promise<string> => {
  await enrichPathFromLoginShell();
  const systemNode = await resolveSystemCommand("node");
  if (!systemNode) {
    throw new Error("Node.js executable not found on PATH");
  }
  return systemNode;
};

export const resolveNodeRuntime = async (): Promise<NodeRuntime> => {
  const preference = getNodeRuntimePreference();
  if (preference === "custom") {
    const customPath = getCustomNodePath();
    if (!customPath) {
      throw new Error("Custom Node.js path is not set or invalid.");
    }
    return { file: customPath, source: "custom" };
  }
  return {
    file: await resolveSystemNode(),
    source: "system",
  };
};

// Resolve entry point from wrapper scripts
const resolveEntryFromWrapper = (binPath: string, content: string): string | null => {
  const baseDir = path.dirname(binPath);
  const basedirMatch = content.match(/\$basedir[\\/]\.\.[\\/](\S+?\.js)/);
  if (basedirMatch?.[1]) {
    const relativePath = basedirMatch[1].replace(/["'`]/g, "");
    return path.resolve(baseDir, "..", relativePath);
  }
  const cmdMatch = content.match(/%~dp0\\\.\.\\([^\s"'`]+\.js)/i);
  if (cmdMatch?.[1]) {
    const relativePath = cmdMatch[1].replace(/\\+/g, path.sep);
    return path.resolve(baseDir, "..", relativePath);
  }
  return null;
};

export const resolveActualJsEntry = async (binPath: string): Promise<ResolvedEntry | null> => {
  try {
    const realPath = await fs.realpath(binPath);
    if (realPath.endsWith(".js")) {
      return { path: realPath, isNodeScript: true };
    }
    const content = await fs.readFile(binPath, "utf-8");
    if (content.startsWith("#!/usr/bin/env node") || content.startsWith("#!/usr/bin/node")) {
      return { path: binPath, isNodeScript: true };
    }
    const wrapperEntry = resolveEntryFromWrapper(binPath, content);
    if (wrapperEntry && existsSync(wrapperEntry)) {
      return { path: wrapperEntry, isNodeScript: true };
    }
    return { path: realPath, isNodeScript: false };
  } catch (e) {
    console.warn(`[Main] Failed to resolve actual JS entry for ${binPath}:`, e);
    return null;
  }
};

export const resolveAuthCommand = async (command: string): Promise<ResolvedCommand | null> => {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const [cmdName, ...cmdArgs] = parseCommandLine(trimmed);
  if (!cmdName) return null;

  const localBin = getLocalAgentBin(cmdName);
  if (!localBin) {
    return { file: cmdName, args: cmdArgs };
  }

  const actualEntry = await resolveActualJsEntry(localBin);
  const shouldUseNode = actualEntry?.isNodeScript ?? false;

  if (shouldUseNode) {
    const nodeRuntime = await resolveNodeRuntime();
    const jsPath = actualEntry?.path || localBin;
    return {
      file: nodeRuntime.file,
      args: [jsPath, ...cmdArgs],
      env: nodeRuntime.env,
    };
  }

  return { file: localBin, args: cmdArgs };
};

// PATH enrichment from login shell
export const enrichPathFromLoginShell = async () => {
  if (process.platform === "win32" || pathEnrichedFromShell) return;
  if (pathEnrichmentInFlight) {
    await pathEnrichmentInFlight;
    return;
  }

  pathEnrichmentInFlight = (async () => {
    try {
      const { runInLoginShell } = await import("./shell");
      const { stdout } = await runInLoginShell('echo "$PATH"');
      const loginPath = stdout.trim();
      if (loginPath) {
        const current = process.env[PATH_KEY] || "";
        const merged = [...new Set([...loginPath.split(":"), ...current.split(":")])]
          .filter(Boolean)
          .join(":");
        (process.env as Record<string, string>)[PATH_KEY] = merged;
      }
      pathEnrichedFromShell = true;
    } catch (e) {
      console.warn("[Main] Failed to enrich PATH from login shell:", e);
    } finally {
      pathEnrichmentInFlight = null;
    }
  })();

  await pathEnrichmentInFlight;
};
