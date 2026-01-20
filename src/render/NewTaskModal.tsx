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
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div ref={modalRef} className="modal-content large">
        <div className="modal-header" style={{ display: "block" }}>
          <div className="modal-title">Create New Task</div>
          <div className="modal-subtitle">
            Choose a workspace folder and agent to start.
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-label">Task Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title"
            className="modal-input"
          />
        </div>

        <div className="modal-section">
          <label className="modal-label">Workspace Folder</label>
          <div className="input-group">
            <button
              type="button"
              onClick={handlePickFolder}
              className="btn-secondary"
            >
              Select Folder
            </button>
            <div
              className={`input-group-text ${
                workspacePath ? "" : "placeholder"
              }`}
              title={workspacePath}
            >
              {workspacePath || "No folder selected"}
            </div>
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-label">Agent</label>
          <div className="preset-buttons" style={{ marginBottom: "12px" }}>
            <button
              type="button"
              onClick={() => setPreset("qwen")}
              className={`preset-button ${preset === "qwen" ? "active" : ""}`}
            >
              Qwen Agent
            </button>
            <button
              type="button"
              onClick={() => setPreset("custom")}
              className={`preset-button ${preset === "custom" ? "active" : ""}`}
            >
              Custom
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="new-task-agent-command" className="modal-input-hint">
              Agent Command
            </label>
            <input
              id="new-task-agent-command"
              type="text"
              value={preset === "qwen" ? defaultQwenCommand : customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              disabled={preset === "qwen"}
              placeholder="Enter agent command"
              className="modal-input"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
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
            className="btn-primary"
            style={
              !canCreate
                ? {
                    backgroundColor: "var(--color-surface-muted)",
                    color: "var(--color-text-secondary)",
                    cursor: "not-allowed",
                  }
                : undefined
            }
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );

};

export default NewTaskModal;
