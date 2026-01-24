import { Check, ChevronDown, Plus, Trash2, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AGENT_PLUGINS, getAgentPlugin } from "./agents/registry";
import { useClickOutside, useEscapeKey, useNodeRuntime } from "./hooks";

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
  const [pluginInstallStatuses, setPluginInstallStatuses] = useState<
    Record<string, string>
  >({});

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

  // Check install status for all plugins
  useEffect(() => {
    const checkAllPlugins = async () => {
      const statuses: Record<string, string> = {};
      for (const plugin of AGENT_PLUGINS) {
        try {
          if (plugin.checkCommand) {
            const res = await window.electron.invoke(
              "agent:check-command",
              plugin.checkCommand,
            );
            statuses[plugin.id] = res.installed ? "installed" : "not-installed";
          } else {
            statuses[plugin.id] = "installed";
          }
        } catch {
          statuses[plugin.id] = "not-installed";
        }
      }
      setPluginInstallStatuses(statuses);
    };

    if (isOpen) {
      checkAllPlugins();
    }
  }, [isOpen]);

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
      const heuristic =
        plugin.checkCommand || plugin.defaultCommand.split(" ")[0];
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
    [agentEnv, onAgentEnvChange],
  );

  const handlePluginChange = useCallback(
    (pluginId: string) => {
      setSelectedPluginId(pluginId);
      const plugin = getAgentPlugin(pluginId);
      onAgentCommandChange(plugin?.defaultCommand ?? "");
    },
    [onAgentCommandChange],
  );

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
                    className={`preset-button ${nodeRuntime === "bundled" ? "active" : ""}`}
                    onClick={() => setNodeRuntime("bundled")}
                  >
                    Bundled (Electron)
                  </button>
                  <button
                    type="button"
                    className={`preset-button ${nodeRuntime === "custom" ? "active" : ""}`}
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
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            {plugin.name}
                            {pluginInstallStatuses[plugin.id] ===
                              "installed" && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                (已安装)
                              </span>
                            )}
                            {pluginInstallStatuses[plugin.id] ===
                              "not-installed" && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--error)",
                                }}
                              >
                                (未安装)
                              </span>
                            )}
                          </div>
                          {selectedPluginId === plugin.id && (
                            <Check size={14} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

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
