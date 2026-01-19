import { X, Check, Download, Loader2, Trash2, Plus } from "lucide-react";
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
    "checking" | "installed" | "not-installed" | "installing"
  >("checking");
  const [nodeStatus, setNodeStatus] = useState<"checking" | "installed" | "not-installed">("checking");
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
    try {
      // Check for 'qwen' command (default bin for @qwen-code/qwen-code is 'qwen')
      const res = await window.electron.invoke("agent:check-command", "qwen");
      setInstallStatus(res.installed ? "installed" : "not-installed");
    } catch (e) {
      setInstallStatus("not-installed");
    }
  };

  const handleInstall = async () => {
    setInstallStatus("installing");
    try {
      // Install '@qwen-code/qwen-code@latest'
      const res = await window.electron.invoke("agent:install", "@qwen-code/qwen-code@latest");
      if (res.success) {
        setInstallStatus("installed");
        // Ensure command is set correctly
        onAgentCommandChange("qwen --acp");
      } else {
        alert(`Installation failed: ${res.error}`);
        setInstallStatus("not-installed");
      }
    } catch (e) {
      setInstallStatus("not-installed");
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
      await window.electron.invoke("agent:auth-terminal", cmd, currentWorkspace);
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
      onAgentCommandChange("qwen --acp");
    } else {
      onAgentCommandChange("");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          width: "500px",
          maxWidth: "90%",
          padding: "24px",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>Settings</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Node.js Warning */}
        {nodeStatus === "not-installed" && (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fee2e2",
              borderRadius: "6px",
              color: "#991b1b",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "start",
              gap: "8px",
            }}
          >
            <div style={{ marginTop: "2px" }}>⚠️</div>
            <div>
              <strong>Node.js Environment Missing</strong>
              <div style={{ marginTop: "4px", fontSize: "0.85rem", opacity: 0.9 }}>
                No system Node.js found. Some agents may fail to start. Please install Node.js or ensure the bundled runtime is available.
              </div>
            </div>
          </div>
        )}

        {/* Agent Preset Selector */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.9rem",
              fontWeight: 500,
              marginBottom: "8px",
              color: "#374151",
            }}
          >
            Agent Type
          </label>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              onClick={() => handlePresetChange("custom")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: `1px solid ${preset === "custom" ? "#f97316" : "#d1d5db"}`,
                backgroundColor: preset === "custom" ? "#fff7ed" : "white",
                color: preset === "custom" ? "#c2410c" : "#374151",
                cursor: "pointer",
              }}
            >
              Custom
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange("qwen")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: `1px solid ${preset === "qwen" ? "#f97316" : "#d1d5db"}`,
                backgroundColor: preset === "qwen" ? "#fff7ed" : "white",
                color: preset === "qwen" ? "#c2410c" : "#374151",
                cursor: "pointer",
              }}
            >
              Qwen Agent
            </button>
          </div>
        </div>

        {/* Qwen Status & Install */}
        {preset === "qwen" && (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px",
              backgroundColor: "#f3f4f6",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>Status:</span>
              {installStatus === "checking" && (
                <span style={{ color: "#6b7280", fontSize: "0.9rem" }}>Checking...</span>
              )}
              {installStatus === "installed" && (
                <span
                  style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Check size={16} /> Installed
                </span>
              )}
              {installStatus === "not-installed" && (
                <span style={{ color: "#ef4444", fontSize: "0.9rem" }}>Not Installed</span>
              )}
              {installStatus === "installing" && (
                <span
                  style={{ color: "#f97316", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Loader2 size={16} className="animate-spin" /> Installing...
                </span>
              )}
            </div>

            {installStatus === "not-installed" && (
              <button
                type="button"
                onClick={handleInstall}
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  backgroundColor: "#f97316",
                  color: "white",
                  border: "none",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Download size={14} /> Install
              </button>
            )}
          </div>
        )}

        {/* Command Input */}
        <div style={{ marginBottom: "20px" }}>
          <label
            htmlFor="agent-command"
            style={{
              display: "block",
              fontSize: "0.9rem",
              fontWeight: 500,
              marginBottom: "8px",
              color: "#374151",
            }}
          >
            Agent Command
          </label>
          <input
            id="agent-command"
            type="text"
            value={agentCommand}
            onChange={(e) => onAgentCommandChange(e.target.value)}
            placeholder="e.g. qwen --acp"
            disabled={preset === "qwen"}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "0.9rem",
              boxSizing: "border-box",
              backgroundColor: preset === "qwen" ? "#f9fafb" : "white",
            }}
          />
        </div>

        {/* Environment Variables */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.9rem",
              fontWeight: 500,
              marginBottom: "8px",
              color: "#374151",
            }}
          >
            Environment Variables
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {Object.entries(agentEnv).map(([key, val]) => (
              <div key={key} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  readOnly
                  value={key}
                  style={{
                    flex: 1,
                    padding: "6px",
                    borderRadius: "4px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#f9fafb",
                    fontSize: "0.85rem",
                  }}
                />
                <input
                  readOnly
                  value={val}
                  type="password"
                  style={{
                    flex: 2,
                    padding: "6px",
                    borderRadius: "4px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#f9fafb",
                    fontSize: "0.85rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeEnvVar(key)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444" }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                placeholder="KEY"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                style={{
                  flex: 1,
                  padding: "6px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  fontSize: "0.85rem",
                }}
              />
              <input
                placeholder="VALUE"
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                style={{
                  flex: 2,
                  padding: "6px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  fontSize: "0.85rem",
                }}
              />
              <button
                type="button"
                onClick={addEnvVar}
                disabled={!newEnvKey.trim()}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: newEnvKey.trim() ? "#10b981" : "#d1d5db",
                }}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "16px",
          }}
        >
          {preset === "qwen" && installStatus === "installed" && !isConnected ? (
            <>
              <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleAuthTerminal}
                  title="Open terminal to login manually (type '/auth')"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "white",
                    color: "#374151",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span style={{ fontSize: "1.1em" }}>🔑</span> Authenticate in Terminal
                </button>
              </div>
              <button
                type="button"
                onClick={onConnectToggle}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#10b981",
                  color: "white",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Connect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onConnectToggle}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: isConnected ? "#ef4444" : "#10b981",
                color: "white",
                fontSize: "0.9rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
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
