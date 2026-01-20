import type React from "react";
import { useEffect, useRef, useState } from "react";

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    workspace: string;
    agentCommand: string;
  }) => void;
  initialWorkspace: string | null;
  initialAgentCommand: string;
  defaultQwenCommand: string;
}

type AgentPreset = "custom" | "qwen";

const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  initialWorkspace,
  initialAgentCommand,
  defaultQwenCommand,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("New Task");
  const [workspacePath, setWorkspacePath] = useState(initialWorkspace || "");
  const [preset, setPreset] = useState<AgentPreset>("custom");
  const [customCommand, setCustomCommand] = useState(initialAgentCommand);

  useEffect(() => {
    if (!isOpen) return;
    const isQwen = initialAgentCommand.includes("qwen");
    setTitle("New Task");
    setPreset(isQwen ? "qwen" : "custom");
    setWorkspacePath(initialWorkspace || "");
    setCustomCommand(initialAgentCommand);
  }, [isOpen, initialWorkspace, initialAgentCommand]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handlePickFolder = async () => {
    try {
      const path = await window.electron.invoke("dialog:openFolder");
      if (path) {
        setWorkspacePath(path);
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  const resolvedCommand =
    preset === "qwen" ? defaultQwenCommand : customCommand.trim();
  const canCreate = Boolean(workspacePath && resolvedCommand);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.25)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
        padding: "16px",
      }}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          width: "min(640px, 100%)",
          padding: "20px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.15)",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            Create New Task
          </div>
          <div style={{ fontSize: "0.9rem", color: "#6b7280" }}>
            Choose a workspace folder and agent to start.
          </div>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            Task Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "0.9rem",
              backgroundColor: "#ffffff",
              color: "#111827",
            }}
          />
        </div>

        <div style={{ marginBottom: "18px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            Workspace Folder
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={handlePickFolder}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
                cursor: "pointer",
                fontWeight: 600,
                color: "#111827",
              }}
            >
              Select Folder
            </button>
            <div
              style={{
                flex: 1,
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "0.85rem",
                color: workspacePath ? "#111827" : "#9ca3af",
                backgroundColor: "#ffffff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={workspacePath}
            >
              {workspacePath || "No folder selected"}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            Agent
          </label>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <button
              type="button"
              onClick={() => setPreset("qwen")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                border: `1px solid ${preset === "qwen" ? "#f97316" : "#d1d5db"}`,
                backgroundColor: preset === "qwen" ? "#fff7ed" : "#ffffff",
                color: preset === "qwen" ? "#c2410c" : "#374151",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Qwen Agent
            </button>
            <button
              type="button"
              onClick={() => setPreset("custom")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                border: `1px solid ${
                  preset === "custom" ? "#f97316" : "#d1d5db"
                }`,
                backgroundColor: preset === "custom" ? "#fff7ed" : "#ffffff",
                color: preset === "custom" ? "#c2410c" : "#374151",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Custom
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="new-task-agent-command"
              style={{ fontSize: "0.8rem", color: "#6b7280" }}
            >
              Agent Command
            </label>
            <input
              id="new-task-agent-command"
              type="text"
              value={preset === "qwen" ? defaultQwenCommand : customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              disabled={preset === "qwen"}
              placeholder="Enter agent command"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "0.9rem",
                backgroundColor: preset === "qwen" ? "#f9fafb" : "#ffffff",
                color: preset === "qwen" ? "#9ca3af" : "#111827",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              cursor: "pointer",
              fontWeight: 600,
              color: "#374151",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onCreate({
                title: title.trim() || "New Task",
                workspace: workspacePath,
                agentCommand: resolvedCommand,
              })
            }
            disabled={!canCreate}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: canCreate ? "#f97316" : "#f3f4f6",
              color: canCreate ? "#ffffff" : "#9ca3af",
              cursor: canCreate ? "pointer" : "not-allowed",
              fontWeight: 600,
            }}
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewTaskModal;
