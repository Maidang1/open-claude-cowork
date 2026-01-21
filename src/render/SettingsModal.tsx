import {
  X,
  Check,
  Download,
  Loader2,
  Trash2,
  Plus,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { AGENT_PLUGINS, getAgentPlugin } from "./agents/registry";
import { AgentPlugin } from "./agents/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentCommand: string;
  onAgentCommandChange: (value: string) => void;
  agentEnv: Record<string, string>;
  onAgentEnvChange: (env: Record<string, string>) => void;
  isConnected: boolean;
  onConnectToggle: () => void;
  currentWorkspace: string | null;
}

type NodeRuntimePreference = "bundled" | "custom";

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  agentCommand,
  onAgentCommandChange,
  agentEnv,
  onAgentEnvChange,
  isConnected,
  onConnectToggle,
  currentWorkspace,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedPluginId, setSelectedPluginId] = useState<string>("custom");
  const [installStatus, setInstallStatus] = useState<
    | "checking"
    | "installed"
    | "not-installed"
    | "installing"
    | "updating"
    | "uninstalling"
  >("checking");
  const [nodeStatus, setNodeStatus] = useState<
    "checking" | "installed" | "not-installed"
  >("checking");
  const [nodeRuntime, setNodeRuntime] =
    useState<NodeRuntimePreference>("bundled");
  const [customNodePath, setCustomNodePath] = useState("");
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeSaved, setRuntimeSaved] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");
  const [activeTab, setActiveTab] = useState<"agents" | "general">("agents");
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedPlugin = getAgentPlugin(selectedPluginId);

  // Check Node availability on mount (node is used to run JS agents)
  useEffect(() => {
    if (isOpen) {
      checkNode();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadRuntimeSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setRuntimeSaved(false);
      setRuntimeError(null);
    }
  }, [isOpen, nodeRuntime, customNodePath]);

  const checkNode = async () => {
    try {
      const res = await window.electron.invoke("agent:check-command", "node");
      setNodeStatus(res.installed ? "installed" : "not-installed");
    } catch (e) {
      setNodeStatus("not-installed");
    }
  };

  const loadRuntimeSettings = async () => {
    try {
      const runtime = await window.electron.invoke("env:get-node-runtime");
      if (runtime === "bundled" || runtime === "custom") {
        setNodeRuntime(runtime);
      }
      const storedPath = await window.electron.invoke(
        "env:get-custom-node-path",
      );
      if (storedPath) {
        setCustomNodePath(storedPath);
      }
      setRuntimeError(null);
      setRuntimeSaved(false);
    } catch (e: any) {
      setRuntimeError(e.message || "Failed to load runtime settings");
    }
  };

  const handleBrowseNodePath = async () => {
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
  };

  const handleApplyRuntime = async () => {
    setRuntimeSaving(true);
    setRuntimeError(null);
    setRuntimeSaved(false);
    try {
      const res = await window.electron.invoke(
        "env:set-node-runtime",
        nodeRuntime,
      );
      if (res?.success === false) {
        throw new Error(res.error || "Failed to save runtime");
      }
      if (nodeRuntime === "custom") {
        if (!customNodePath.trim()) {
          throw new Error("Custom Node.js path is required.");
        }
        const validation = await window.electron.invoke(
          "env:validate-node-path",
          customNodePath,
        );
        if (!validation.valid) {
          throw new Error(validation.error || "Invalid Node.js path");
        }
        await window.electron.invoke(
          "env:set-custom-node-path",
          customNodePath,
        );
      }
      await checkNode();
      setRuntimeSaved(true);
    } catch (e: any) {
      setRuntimeError(e.message || "Failed to save runtime settings");
    } finally {
      setRuntimeSaving(false);
    }
  };

  const handleRestart = async () => {
    await window.electron.invoke("app:relaunch");
  };

  // Auto-detect preset based on command
  useEffect(() => {
    if (isOpen) {
      let found = false;
      // Simple heuristic: check if command contains any plugin's checkCommand or part of default command
      for (const plugin of AGENT_PLUGINS) {
        const heuristic =
          plugin.checkCommand || plugin.defaultCommand.split(" ")[0];
        if (agentCommand.includes(heuristic)) {
          setSelectedPluginId(plugin.id);
          found = true;
          break;
        }
      }
      if (!found) {
        setSelectedPluginId("custom");
      }
    }
  }, [isOpen]); // Run when modal opens

  useEffect(() => {
    if (selectedPlugin && isOpen && selectedPlugin.packageSpec) {
      checkInstall(selectedPlugin);
    }
  }, [selectedPluginId, isOpen]);

  const checkInstall = async (plugin: AgentPlugin) => {
    if (!plugin.checkCommand || !plugin.packageSpec) {
      setInstallStatus("installed"); // Assume installed if no check
      return;
    }

    setInstallStatus("checking");
    setInstalledVersion(null);
    try {
      const res = await window.electron.invoke(
        "agent:check-command",
        plugin.checkCommand,
      );
      if (res.installed) {
        const versionRes = await window.electron.invoke(
          "agent:get-package-version",
          plugin.packageSpec,
        );
        if (versionRes.success && versionRes.version) {
          setInstalledVersion(versionRes.version);
        }
        setInstallStatus("installed");
      } else {
        setInstallStatus("not-installed");
      }
    } catch (e) {
      setInstallStatus("not-installed");
      setInstalledVersion(null);
    }
  };

  const installLatest = async (mode: "install" | "update") => {
    if (!selectedPlugin?.packageSpec) return;

    setInstallStatus(mode === "install" ? "installing" : "updating");
    try {
      const res = await window.electron.invoke(
        "agent:install",
        `${selectedPlugin.packageSpec}@latest`,
      );
      if (res.success) {
        setInstallStatus("installed");
        setInstalledVersion(null);
        if (selectedPlugin) checkInstall(selectedPlugin);
        // Ensure command is set correctly
        onAgentCommandChange(selectedPlugin.defaultCommand);
      } else {
        alert(`Installation failed: ${res.error}`);
        setInstallStatus("not-installed");
      }
    } catch (e) {
      setInstallStatus("not-installed");
    }
  };

  const handleInstall = () => {
    installLatest("install");
  };

  const handleUpdate = () => {
    installLatest("update");
  };

  const handleUninstall = async () => {
    if (!selectedPlugin?.packageSpec) return;

    setInstallStatus("uninstalling");
    try {
      const res = await window.electron.invoke(
        "agent:uninstall",
        selectedPlugin.packageSpec,
      );
      if (res.success) {
        setInstallStatus("not-installed");
        setInstalledVersion(null);
      } else {
        alert(`Uninstall failed: ${res.error}`);
        setInstallStatus("installed");
      }
    } catch (e) {
      alert(`Uninstall failed: ${(e as Error).message}`);
      setInstallStatus("installed");
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const addEnvVar = () => {
    if (newEnvKey.trim()) {
      onAgentEnvChange({ ...agentEnv, [newEnvKey.trim()]: newEnvVal });
      setNewEnvKey("");
      setNewEnvVal("");
    }
  };

  const handleAuthTerminal = async () => {
    try {
      // Auth in terminal should launch without extra args.
      const cmd =
        selectedPlugin?.checkCommand ||
        agentCommand.split(" ")[0] ||
        agentCommand.trim();
      const res = await window.electron.invoke(
        "agent:auth-terminal",
        cmd,
        currentWorkspace,
      );
      if (!res?.success) {
        console.error(
          `Failed to launch terminal: ${res?.error || "unknown error"}`,
        );
      }
    } catch (e: any) {
      console.error(`Failed to launch terminal: ${e.message}`);
    }
  };

  const removeEnvVar = (key: string) => {
    const next = { ...agentEnv };
    delete next[key];
    onAgentEnvChange(next);
  };

  const handlePluginChange = (pluginId: string) => {
    setSelectedPluginId(pluginId);
    const plugin = getAgentPlugin(pluginId);
    if (plugin) {
      onAgentCommandChange(plugin.defaultCommand);
    } else {
      onAgentCommandChange("");
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsAgentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div ref={modalRef} className="modal-content settings-modal">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div
            style={{
              padding: "8px 12px",
              marginBottom: "12px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Settings
          </div>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === "agents" ? "active" : ""}`}
            onClick={() => setActiveTab("agents")}
          >
            <span>🤖</span> Agents
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === "general" ? "active" : ""}`}
            onClick={() => setActiveTab("general")}
          >
            <span>⚙️</span> General
          </button>
        </div>

        {/* Content Area */}
        <div className="settings-content">
          <div className="settings-content-header">
            <h2 className="settings-title">
              {activeTab === "agents"
                ? "Agents Configuration"
                : "General Settings"}
            </h2>
            <button type="button" onClick={onClose} className="modal-close-btn">
              <X size={20} />
            </button>
          </div>

          {activeTab === "general" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div className="modal-section">
                <label className="modal-label">Node Runtime</label>
                <span className="modal-input-hint">
                  Choose the runtime used to launch JS agents. Changes apply
                  after restart.
                </span>
                <div className="preset-buttons" style={{ maxWidth: "420px" }}>
                  <button
                    type="button"
                    className={`preset-button ${
                      nodeRuntime === "bundled" ? "active" : ""
                    }`}
                    onClick={() => setNodeRuntime("bundled")}
                  >
                    Bundled (Electron)
                  </button>
                  <button
                    type="button"
                    className={`preset-button ${
                      nodeRuntime === "custom" ? "active" : ""
                    }`}
                    onClick={() => setNodeRuntime("custom")}
                  >
                    Custom Path
                  </button>
                </div>

                {nodeRuntime === "custom" && (
                  <>
                    <label
                      className="modal-label"
                      style={{ marginTop: "16px" }}
                    >
                      Custom Node.js Path
                    </label>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <input
                        className="modal-input"
                        style={{ flex: 1, minWidth: "240px" }}
                        placeholder="/path/to/node"
                        value={customNodePath}
                        onChange={(e) => setCustomNodePath(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleBrowseNodePath}
                      >
                        Browse...
                      </button>
                    </div>
                    <span className="modal-input-hint">
                      Point to the Node.js executable (not a directory).
                    </span>
                  </>
                )}

                {runtimeError && (
                  <div style={{ marginTop: "12px", color: "var(--error)" }}>
                    {runtimeError}
                  </div>
                )}
                {runtimeSaved && !runtimeError && (
                  <div
                    style={{
                      marginTop: "12px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Saved. Please restart the app to apply changes.
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                    marginTop: "16px",
                  }}
                >
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleRestart}
                    disabled={runtimeSaving}
                  >
                    Restart App
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleApplyRuntime}
                    disabled={
                      runtimeSaving ||
                      (nodeRuntime === "custom" && !customNodePath.trim())
                    }
                  >
                    {runtimeSaving ? "Saving..." : "Apply"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "agents" && (
            <>
              {/* Node Warning */}
              {nodeStatus === "not-installed" && (
                <div className="node-warning">
                  <div style={{ marginTop: "2px" }}>⚠️</div>
                  <div>
                    <strong>Node.js Environment Missing</strong>
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "0.85rem",
                        opacity: 0.9,
                      }}
                    >
                      No Node.js runtime found. Some agents may fail to start.
                      If using a custom path, verify it; otherwise ensure the
                      bundled runtime is available.
                    </div>
                  </div>
                </div>
              )}

              {/* Agent Selector (Custom Dropdown) */}
              <div className="settings-agent-selector">
                <label className="modal-label">Select Agent to Configure</label>
                <div className="custom-select-container" ref={dropdownRef}>
                  <button
                    type="button"
                    className="custom-select-trigger"
                    onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                  >
                    <span>
                      {selectedPlugin ? selectedPlugin.name : "Custom Agent"}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`select-arrow ${isAgentDropdownOpen ? "open" : ""}`}
                    />
                  </button>

                  {isAgentDropdownOpen && (
                    <div className="custom-select-dropdown">
                      <button
                        type="button"
                        className={`custom-select-option ${selectedPluginId === "custom" ? "selected" : ""}`}
                        onClick={() => {
                          handlePluginChange("custom");
                          setIsAgentDropdownOpen(false);
                        }}
                      >
                        Custom Agent
                        {selectedPluginId === "custom" && <Check size={14} />}
                      </button>
                      {AGENT_PLUGINS.map((plugin) => (
                        <button
                          key={plugin.id}
                          type="button"
                          className={`custom-select-option ${selectedPluginId === plugin.id ? "selected" : ""}`}
                          onClick={() => {
                            handlePluginChange(plugin.id);
                            setIsAgentDropdownOpen(false);
                          }}
                        >
                          {plugin.name}
                          {selectedPluginId === plugin.id && (
                            <Check size={14} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Plugin Status & Install */}
              {selectedPlugin && selectedPlugin.packageSpec && (
                <div
                  className="status-box"
                  style={{ marginTop: 0, marginBottom: "20px" }}
                >
                  <div className="status-info">
                    <span className="status-label">Status:</span>
                    {installStatus === "checking" && (
                      <span className="status-text checking">Checking...</span>
                    )}
                    {installStatus === "installed" && (
                      <span className="status-text installed">
                        <Check size={16} /> Installed
                        {installedVersion && (
                          <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>
                            v{installedVersion}
                          </span>
                        )}
                      </span>
                    )}
                    {installStatus === "not-installed" && (
                      <span className="status-text not-installed">
                        Not Installed
                      </span>
                    )}
                    {installStatus === "installing" && (
                      <span className="status-text processing">
                        <Loader2 size={16} className="animate-spin" />{" "}
                        Installing...
                      </span>
                    )}
                    {installStatus === "updating" && (
                      <span className="status-text processing">
                        <Loader2 size={16} className="animate-spin" />{" "}
                        Updating...
                      </span>
                    )}
                    {installStatus === "uninstalling" && (
                      <span className="status-text processing">
                        <Loader2 size={16} className="animate-spin" />{" "}
                        Uninstalling...
                      </span>
                    )}
                  </div>

                  {installStatus === "not-installed" && (
                    <button
                      type="button"
                      onClick={handleInstall}
                      className="btn-primary btn-small"
                    >
                      <Download size={14} /> Install
                    </button>
                  )}
                  {installStatus === "installed" && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={handleUpdate}
                        className="btn-primary btn-small"
                      >
                        <RefreshCw size={14} /> Update
                      </button>
                      <button
                        type="button"
                        onClick={handleUninstall}
                        className="btn-danger-outline"
                      >
                        <Trash2 size={14} /> Uninstall
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Command Input */}
              <div className="modal-section">
                <label htmlFor="agent-command" className="modal-label">
                  Agent Command
                </label>
                <input
                  id="agent-command"
                  type="text"
                  value={agentCommand}
                  onChange={(e) => onAgentCommandChange(e.target.value)}
                  placeholder="e.g. qwen --acp"
                  disabled={!!selectedPlugin}
                  className="modal-input"
                />
                <span className="modal-input-hint" style={{ marginTop: "6px" }}>
                  The command used to launch the agent process.
                </span>
              </div>

              {/* Environment Variables */}
              <div className="modal-section">
                <label className="modal-label">Environment Variables</label>
                <div className="env-list">
                  {Object.entries(agentEnv).map(([key, val]) => (
                    <div key={key} className="env-row">
                      <input readOnly value={key} className="env-input key" />
                      <input
                        readOnly
                        value={val}
                        type="password"
                        className="env-input val"
                      />
                      <button
                        type="button"
                        onClick={() => removeEnvVar(key)}
                        className="btn-icon danger"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <div className="env-row">
                    <input
                      placeholder="KEY"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      className="env-input key"
                    />
                    <input
                      placeholder="VALUE"
                      value={newEnvVal}
                      onChange={(e) => setNewEnvVal(e.target.value)}
                      className="env-input val"
                    />
                    <button
                      type="button"
                      onClick={addEnvVar}
                      disabled={!newEnvKey.trim()}
                      className={`btn-icon ${newEnvKey.trim() ? "success" : ""}`}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: "auto" }}>
                {selectedPlugin &&
                selectedPlugin.packageSpec &&
                installStatus === "installed" ? (
                  <div style={{ marginRight: "auto" }}>
                    <button
                      type="button"
                      onClick={handleAuthTerminal}
                      title="Open system terminal to login manually (type '/auth')"
                      className="btn-secondary"
                    >
                      <span style={{ fontSize: "1.1em" }}>🔑</span> Authenticate
                      in Terminal
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={onConnectToggle}
                  className="btn-primary"
                  style={
                    isConnected ? { backgroundColor: "#ef4444" } : undefined
                  }
                >
                  {isConnected ? "Disconnect" : "Connect & Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
