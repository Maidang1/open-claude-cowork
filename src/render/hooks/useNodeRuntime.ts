import { useCallback, useEffect, useState } from "react";

export type NodeRuntimePreference = "bundled" | "custom";

interface NodeRuntimeState {
  nodeRuntime: NodeRuntimePreference;
  customNodePath: string;
  nodeStatus: "checking" | "installed" | "not-installed";
  runtimeSaving: boolean;
  runtimeError: string | null;
  runtimeSaved: boolean;
}

interface NodeRuntimeActions {
  setNodeRuntime: (runtime: NodeRuntimePreference) => void;
  setCustomNodePath: (path: string) => void;
  checkNode: () => Promise<void>;
  loadRuntimeSettings: () => Promise<void>;
  browseNodePath: () => Promise<void>;
  applyRuntime: () => Promise<void>;
  restart: () => Promise<void>;
}

export function useNodeRuntime(isOpen: boolean): NodeRuntimeState & NodeRuntimeActions {
  const [nodeRuntime, setNodeRuntime] = useState<NodeRuntimePreference>("bundled");
  const [customNodePath, setCustomNodePath] = useState("");
  const [nodeStatus, setNodeStatus] = useState<"checking" | "installed" | "not-installed">(
    "checking",
  );
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeSaved, setRuntimeSaved] = useState(false);

  const checkNode = useCallback(async () => {
    try {
      const res = await window.electron.invoke("agent:check-command", "node");
      setNodeStatus(res.installed ? "installed" : "not-installed");
    } catch {
      setNodeStatus("not-installed");
    }
  }, []);

  const loadRuntimeSettings = useCallback(async () => {
    try {
      const runtime = await window.electron.invoke("env:get-node-runtime");
      if (runtime === "bundled" || runtime === "custom") {
        setNodeRuntime(runtime);
      }
      const storedPath = await window.electron.invoke("env:get-custom-node-path");
      if (storedPath) {
        setCustomNodePath(storedPath);
      }
      setRuntimeError(null);
      setRuntimeSaved(false);
    } catch (e: any) {
      setRuntimeError(e.message || "Failed to load runtime settings");
    }
  }, []);

  const browseNodePath = useCallback(async () => {
    const result = await window.electron.invoke("dialog:openFile", {
      title: "Select Node.js executable",
      filters: [
        {
          name: "Executable",
          extensions: process.platform === "win32" ? ["exe"] : ["*"],
        },
      ],
    });
    if (result) {
      setCustomNodePath(result);
    }
  }, []);

  const applyRuntime = useCallback(async () => {
    setRuntimeSaving(true);
    setRuntimeError(null);
    setRuntimeSaved(false);
    try {
      const res = await window.electron.invoke("env:set-node-runtime", nodeRuntime);
      if (res?.success === false) {
        throw new Error(res.error || "Failed to save runtime");
      }
      if (nodeRuntime === "custom") {
        if (!customNodePath.trim()) {
          throw new Error("Custom Node.js path is required.");
        }
        const validation = await window.electron.invoke("env:validate-node-path", customNodePath);
        if (!validation.valid) {
          throw new Error(validation.error || "Invalid Node.js path");
        }
        await window.electron.invoke("env:set-custom-node-path", customNodePath);
      }
      await checkNode();
      setRuntimeSaved(true);
    } catch (e: any) {
      setRuntimeError(e.message || "Failed to save runtime settings");
    } finally {
      setRuntimeSaving(false);
    }
  }, [nodeRuntime, customNodePath, checkNode]);

  const restart = useCallback(async () => {
    await window.electron.invoke("app:relaunch");
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkNode();
      loadRuntimeSettings();
    }
  }, [isOpen, checkNode, loadRuntimeSettings]);

  useEffect(() => {
    if (isOpen) {
      setRuntimeSaved(false);
      setRuntimeError(null);
    }
  }, [isOpen, nodeRuntime, customNodePath]);

  return {
    nodeRuntime,
    customNodePath,
    nodeStatus,
    runtimeSaving,
    runtimeError,
    runtimeSaved,
    setNodeRuntime,
    setCustomNodePath,
    checkNode,
    loadRuntimeSettings,
    browseNodePath,
    applyRuntime,
    restart,
  };
}
