import type React from "react";
import { useEffect, useRef, useState } from "react";
import { AGENT_PLUGINS, getAgentPlugin } from "./agents/registry";

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: { title: string; workspace: string; agentCommand: string }) => void;
  initialWorkspace: string | null;
  initialAgentCommand: string;
  defaultQwenCommand?: string;
}

const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  initialWorkspace,
  initialAgentCommand,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("New Task");
  const [workspacePath, setWorkspacePath] = useState(initialWorkspace || "");
  const [selectedPluginId, setSelectedPluginId] = useState<string>("custom");
  const [customCommand, setCustomCommand] = useState(initialAgentCommand);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("New Task");
    setWorkspacePath(initialWorkspace || "");

    // Determine plugin from initial command
    let found = false;
    for (const plugin of AGENT_PLUGINS) {
      const heuristic = plugin.checkCommand || plugin.defaultCommand.split(" ")[0];
      if (initialAgentCommand.includes(heuristic)) {
        setSelectedPluginId(plugin.id);
        // If the command is exactly the default, we might just set it, but user might have modified arguments.
        // We can store the custom command anyway, but UI will show the plugin's default if a plugin is selected.
        // Wait, if I select a plugin, the input is disabled and shows the default command.
        // If the user had a slightly modified Qwen command, and I select "Qwen Plugin", they lose their modification in the UI view.
        // However, for "New Task", we usually start fresh or from previous settings.
        // If the previous setting matches Qwen, we select Qwen.
        found = true;
        break;
      }
    }
    if (!found) {
      setSelectedPluginId("custom");
      setCustomCommand(initialAgentCommand);
    }
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

  const selectedPlugin = getAgentPlugin(selectedPluginId);
  const resolvedCommand = selectedPlugin ? selectedPlugin.defaultCommand : customCommand.trim();

  const canCreate = Boolean(workspacePath && resolvedCommand);

  const handlePluginChange = (pluginId: string) => {
    setSelectedPluginId(pluginId);
    if (pluginId === "custom") {
      // If switching to custom, maybe pre-fill with the last used command or empty
      if (!customCommand) {
        setCustomCommand("");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div ref={modalRef} className="modal-content large">
        <div className="modal-header" style={{ display: "block" }}>
          <div className="modal-title">Create New Task</div>
          <div className="modal-subtitle">Choose a workspace folder and agent to start.</div>
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
            <button type="button" onClick={handlePickFolder} className="btn-secondary">
              Select Folder
            </button>
            <div
              className={`input-group-text ${workspacePath ? "" : "placeholder"}`}
              title={workspacePath}
            >
              {workspacePath || "No folder selected"}
            </div>
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-label">Agent</label>
          <div className="preset-buttons" style={{ marginBottom: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => handlePluginChange("custom")}
              className={`preset-button ${selectedPluginId === "custom" ? "active" : ""}`}
            >
              Custom
            </button>
            {AGENT_PLUGINS.map((plugin) => (
              <button
                key={plugin.id}
                type="button"
                onClick={() => handlePluginChange(plugin.id)}
                className={`preset-button ${selectedPluginId === plugin.id ? "active" : ""}`}
              >
                {plugin.name}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="new-task-agent-command" className="modal-input-hint">
              Agent Command
            </label>
            <input
              id="new-task-agent-command"
              type="text"
              value={selectedPlugin ? selectedPlugin.defaultCommand : customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              disabled={!!selectedPlugin}
              placeholder="Enter agent command"
              className="modal-input"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">
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
