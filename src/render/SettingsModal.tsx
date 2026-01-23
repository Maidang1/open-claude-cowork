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
import { useCallback, useEffect, useRef, useState } from "react";
import { AGENT_PLUGINS, getAgentPlugin } from "./agents/registry";
import {
  useNodeRuntime,
  useAgentInstall,
  useClickOutside,
  useEscapeKey,
} from "./hooks";

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [selectedPluginId, setSelectedPluginId] = useState<string>("custom");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");
  const [activeTab, setActiveTab] = useState<"agents" | "general">("agents");
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);

  const selectedPlugin = getAgentPlugin(selectedPluginId);

  // Use extracted hooks
  const {
    nodeRuntime,
    customNodePath,
    nodeStatus,
    runtimeSaving,
    runtimeError,
    runtimeSaved,
    setNodeRuntime,
    setCustomNodePath,
    browseNodePath,
    applyRuntime,
    restart,
  } = useNodeRuntime(isOpen);

  const {
    installStatus,
    installedVersion,
    install: handleInstall,
    update: handleUpdate,
    uninstall: handleUninstall,
  } = useAgentInstall(selectedPlugin, isOpen, onAgentCommandChange);

  // Close handlers
  useEscapeKey(onClose, isOpen);
  useClickOutside(dropdownRef, () => setIsAgentDropdownOpen(false));

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // Auto-detect preset based on command
  useEffect(() => {
    if (!isOpen) return;
    const found = AGENT_PLUGINS.find((plugin) => {
      const heuristic = plugin.checkCommand || plugin.defaultCommand.split(" ")[0];
      return agentCommand.includes(heuristic);
    });
    setSelectedPluginId(found?.id ?? "custom");
  }, [isOpen, agentCommand]);

  const addEnvVar = useCallback(() => {
    if (newEnvKey.trim()) {
      onAgentEnvChange({ ...agentEnv, [newEnvKey.trim()]: newEnvVal });
      setNewEnvKey("");
      setNewEnvVal("");
    }
  }, [newEnvKey, newEnvVal, agentEnv, onAgentEnvChange]);

  const removeEnvVar = useCallback(
    (key: string) => {
      const next = { ...agentEnv };
      delete next[key];
      onAgentEnvChange(next);
    },
    [agentEnv, onAgentEnvChange]
  );

  const handlePluginChange = useCallback(
    (pluginId: string) => {
      setSelectedPluginId(pluginId);
      const plugin = getAgentPlugin(pluginId);
      onAgentCommandChange(plugin?.defaultCommand ?? "");
    },
    [onAgentCommandChange]
  );

  const handleAuthTerminal = useCallback(async () => {
    try {
      const cmd =
        selectedPlugin?.checkCommand ||
        agentCommand.split(" ")[0] ||
        agentCommand.trim();
      const res = await window.electron.invoke(
        "agent:auth-terminal",
        cmd,
        currentWorkspace
      );
      if (!res?.success) {
        console.error(`Failed to launch terminal: ${res?.error || "unknown error"}`);
      }
    } catch (e: any) {
      console.error(`Failed to launch terminal: ${e.message}`);
    }
  }, [selectedPlugin, agentCommand, currentWorkspace]);

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
                        onClick={browseNodePath}
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
                    onClick={restart}
                    disabled={runtimeSaving}
                  >
                    Restart App
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={applyRuntime}
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
