import {
  X,
  Check,
  Download,
  Loader2,
  Trash2,
  Plus,
  RefreshCw,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

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

type AgentPreset = "custom" | "qwen";

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
  const [preset, setPreset] = useState<AgentPreset>("custom");
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
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");

  // Check Node.js availability on mount
  useEffect(() => {
    if (isOpen) {
      checkNode();
    }
  }, [isOpen]);

  const checkNode = async () => {
    try {
      const res = await window.electron.invoke("agent:check-command", "node");
      setNodeStatus(res.installed ? "installed" : "not-installed");
    } catch (e) {
      setNodeStatus("not-installed");
    }
  };

  // Auto-detect preset based on command
  useEffect(() => {
    if (agentCommand.includes("qwen")) {
      setPreset("qwen");
    } else {
      setPreset("custom");
    }
  }, [isOpen]);

  useEffect(() => {
    if (preset === "qwen" && isOpen) {
      checkInstall();
    }
  }, [preset, isOpen]);

  const checkInstall = async () => {
    setInstallStatus("checking");
    setInstalledVersion(null);
    try {
      // Check for 'qwen' command (default bin for @qwen-code/qwen-code is 'qwen')
      const res = await window.electron.invoke("agent:check-command", "qwen");
      if (res.installed) {
        const versionRes = await window.electron.invoke(
          "agent:get-package-version",
          "@qwen-code/qwen-code",
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
    setInstallStatus(mode === "install" ? "installing" : "updating");
    try {
      // Install '@qwen-code/qwen-code@latest'
      const res = await window.electron.invoke(
        "agent:install",
        "@qwen-code/qwen-code@latest",
      );
      if (res.success) {
        setInstallStatus("installed");
        setInstalledVersion(null);
        checkInstall();
        // Ensure command is set correctly
        onAgentCommandChange(
          "qwen --acp --allowed-tools run_shell_command --experimental-skills",
        );
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
    setInstallStatus("uninstalling");
    try {
      const res = await window.electron.invoke(
        "agent:uninstall",
        "@qwen-code/qwen-code",
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
      // Use the raw command or "qwen"
      const cmd = preset === "qwen" ? "qwen" : agentCommand.split(" ")[0];
      await window.electron.invoke(
        "agent:auth-terminal",
        cmd,
        currentWorkspace,
      );
    } catch (e: any) {
      alert(`Failed to launch terminal: ${e.message}`);
    }
  };

  const removeEnvVar = (key: string) => {
    const next = { ...agentEnv };
    delete next[key];
    onAgentEnvChange(next);
  };

  const handlePresetChange = (p: AgentPreset) => {
    setPreset(p);
    if (p === "qwen") {
      onAgentCommandChange(
        "qwen --acp --allowed-tools all,run_shell_command --experimental-skills",
      );
    } else {
      onAgentCommandChange("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div ref={modalRef} className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button type="button" onClick={onClose} className="modal-close-btn">
            <X size={20} />
          </button>
        </div>

        {/* Node.js Warning */}
        {nodeStatus === "not-installed" && (
          <div className="node-warning">
            <div style={{ marginTop: "2px" }}>⚠️</div>
            <div>
              <strong>Node.js Environment Missing</strong>
              <div
                style={{ marginTop: "4px", fontSize: "0.85rem", opacity: 0.9 }}
              >
                No system Node.js found. Some agents may fail to start. Please
                install Node.js or ensure the bundled runtime is available.
              </div>
            </div>
          </div>
        )}

        {/* Agent Preset Selector */}
        <div className="modal-section">
          <label className="modal-label">Agent Type</label>
          <div className="preset-buttons">
            <button
              type="button"
              onClick={() => handlePresetChange("custom")}
              className={`preset-button ${preset === "custom" ? "active" : ""}`}
            >
              Custom
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("qwen")}
              className={`preset-button ${preset === "qwen" ? "active" : ""}`}
            >
              Qwen Agent
            </button>
          </div>
        </div>

        {/* Qwen Status & Install */}
        {preset === "qwen" && (
          <div className="status-box">
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
                <span className="status-text not-installed">Not Installed</span>
              )}
              {installStatus === "installing" && (
                <span className="status-text processing">
                  <Loader2 size={16} className="animate-spin" /> Installing...
                </span>
              )}
              {installStatus === "updating" && (
                <span className="status-text processing">
                  <Loader2 size={16} className="animate-spin" /> Updating...
                </span>
              )}
              {installStatus === "uninstalling" && (
                <span className="status-text processing">
                  <Loader2 size={16} className="animate-spin" /> Uninstalling...
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
            disabled={preset === "qwen"}
            className="modal-input"
          />
        </div>

        {/* Environment Variables */}
        <div className="modal-section">
          <label className="modal-label">Environment Variables</label>
          <div className="env-list">
            {Object.entries(agentEnv).map(([key, val]) => (
              <div key={key} className="env-row">
                <input
                  readOnly
                  value={key}
                  className="env-input key"
                />
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

        <div className="modal-footer">
          {preset === "qwen" &&
          installStatus === "installed" &&
          !isConnected ? (
            <>
              <div style={{ marginRight: "auto" }}>
                <button
                  type="button"
                  onClick={handleAuthTerminal}
                  title="Open terminal to login manually (type '/auth')"
                  className="btn-secondary"
                >
                  <span style={{ fontSize: "1.1em" }}>🔑</span> Authenticate in
                  Terminal
                </button>
              </div>
              <button
                type="button"
                onClick={onConnectToggle}
                className="btn-primary"
              >
                Connect
              </button>
            </>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );

};

export default SettingsModal;
