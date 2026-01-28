import { X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAgentPlugin } from "./agents/registry";
import { AgentSelector, EnvVariables, ThemeSettings, WallpaperSettings } from "./components/settings";
import { useEscapeKey, useNodeRuntime } from "./hooks";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentCommand: string;
  onAgentCommandChange: (value: string) => void;
  agentEnv: Record<string, string>;
  onAgentEnvChange: (env: Record<string, string>) => void;
  isConnected: boolean;
  onConnectToggle: () => void;
  wallpaper: string | null;
  onWallpaperChange: (path: string | null) => void;
  theme: "light" | "dark" | "auto";
  onThemeChange: (theme: "light" | "dark" | "auto") => void;
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
  wallpaper,
  onWallpaperChange,
  theme,
  onThemeChange,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedPluginId, setSelectedPluginId] = useState<string>("custom");
  const [activeTab, setActiveTab] = useState<"agents" | "general" | "display">("agents");
  const [pluginInstallStatuses, setPluginInstallStatuses] = useState<Record<string, string>>({});

  const selectedPlugin = getAgentPlugin(selectedPluginId);

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
      const { AGENT_PLUGINS } = await import("./agents/registry");
      const statuses: Record<string, string> = {};
      for (const plugin of AGENT_PLUGINS) {
        try {
          if (plugin.checkCommand) {
            const res = await window.electron.invoke("agent:check-command", plugin.checkCommand);
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

  useEscapeKey(onClose, isOpen);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // Auto-detect preset based on command
  useEffect(() => {
    if (!isOpen) return;
    const detectPlugin = async () => {
      const { AGENT_PLUGINS } = await import("./agents/registry");
      const found = AGENT_PLUGINS.find((plugin) => {
        const heuristic = plugin.checkCommand || plugin.defaultCommand.split(" ")[0];
        return agentCommand.includes(heuristic);
      });
      setSelectedPluginId(found?.id ?? "custom");
    };
    detectPlugin();
  }, [isOpen, agentCommand]);

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
          <button
            type="button"
            className={`settings-nav-item ${activeTab === "display" ? "active" : ""}`}
            onClick={() => setActiveTab("display")}
          >
            <span>🎨</span> Display
          </button>
        </div>

        {/* Content Area */}
        <div className="settings-content">
          <div className="settings-content-header">
            <h2 className="settings-title">
              {activeTab === "agents"
                ? "Agents Configuration"
                : activeTab === "general"
                  ? "General Settings"
                  : "Display Settings"}
            </h2>
            <button type="button" onClick={onClose} className="modal-close-btn">
              <X size={20} />
            </button>
          </div>

          {activeTab === "display" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <ThemeSettings theme={theme} onThemeChange={onThemeChange} />
              <WallpaperSettings wallpaper={wallpaper} onWallpaperChange={onWallpaperChange} />
            </div>
          )}

          {activeTab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="modal-section">
                <label className="modal-label">Node Runtime</label>
                <span className="modal-input-hint">
                  Choose the runtime used to launch JS agents. Changes apply after restart.
                </span>
                <div className="preset-buttons" style={{ maxWidth: "420px" }}>
                  <button
                    type="button"
                    className={`preset-button ${nodeRuntime === "system" ? "active" : ""}`}
                    onClick={() => setNodeRuntime("system")}
                  >
                    System Node
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
                    <label className="modal-label" style={{ marginTop: "16px" }}>
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
                      <button type="button" className="btn-secondary" onClick={browseNodePath}>
                        Browse...
                      </button>
                    </div>
                    <span className="modal-input-hint">
                      Point to the Node.js executable (not a directory).
                    </span>
                  </>
                )}

                {runtimeError && (
                  <div style={{ marginTop: "12px", color: "var(--error)" }}>{runtimeError}</div>
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
                    disabled={runtimeSaving || (nodeRuntime === "custom" && !customNodePath.trim())}
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
                      No Node.js runtime found. Some agents may fail to start. If using a custom
                      path, verify it; otherwise ensure the system Node runtime is available.
                    </div>
                  </div>
                </div>
              )}

              <AgentSelector
                selectedPluginId={selectedPluginId}
                onPluginChange={handlePluginChange}
                pluginInstallStatuses={pluginInstallStatuses}
              />

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

              <EnvVariables agentEnv={agentEnv} onAgentEnvChange={onAgentEnvChange} />

              <div className="modal-footer" style={{ marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={onConnectToggle}
                  className="btn-primary"
                  style={isConnected ? { backgroundColor: "#ef4444" } : undefined}
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
