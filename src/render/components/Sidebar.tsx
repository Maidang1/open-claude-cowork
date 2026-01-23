import { Plus } from "lucide-react";
import type { Task } from "../types";

interface SidebarProps {
  tasks: Task[];
  activeTaskId: string | null;
  onNewTask: () => void;
  onSelectTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenSettings: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export const Sidebar = ({
  tasks,
  activeTaskId,
  onNewTask,
  onSelectTask,
  onDeleteTask,
  onOpenSettings,
  theme,
  onToggleTheme,
}: SidebarProps) => {
  const { Moon, Sun, Settings, Trash2 } = require("lucide-react");

  return (
    <div className="sidebar">
      <button type="button" className="new-chat-btn" onClick={onNewTask}>
        <Plus size={16} />
        <span>New Task</span>
      </button>

      <div className="history-list">
        {tasks.length === 0 ? (
          <div className="history-empty">No tasks yet.</div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`history-item ${task.id === activeTaskId ? "active" : ""}`}
              onClick={() => onSelectTask(task.id)}
              style={{ position: "relative" }}
            >
              <div className="history-item-row">
                <div className="history-item-title">{task.title}</div>
                <button
                  type="button"
                  className="history-item-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  aria-label="Delete task"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="history-item-subtitle" title={task.workspace}>
                {task.workspace.split("/").pop() || task.workspace}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-settings">
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="sidebar-settings-button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            style={{ flex: 1 }}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className="sidebar-settings-button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            style={{ width: "auto", padding: "10px" }}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
