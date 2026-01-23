import { Plus } from "lucide-react";
import type { Task } from "../types";

interface SidebarProps {
  tasks: Task[];
  activeTaskId: string | null;
  onNewTask: () => void;
  onSelectTask: (taskId: string) => void;
  onTaskContextMenu: (taskId: string, event: React.MouseEvent) => void;
  taskMenu: { taskId: string; x: number; y: number } | null;
  onDeleteTask: (taskId: string) => void;
  onCloseTaskMenu: () => void;
  onOpenSettings: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export const Sidebar = ({
  tasks,
  activeTaskId,
  onNewTask,
  onSelectTask,
  onTaskContextMenu,
  taskMenu,
  onDeleteTask,
  onCloseTaskMenu,
  onOpenSettings,
  theme,
  onToggleTheme,
}: SidebarProps) => {
  const { Moon, Sun, Settings } = require("lucide-react");

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
              onContextMenu={(event) => onTaskContextMenu(task.id, event)}
            >
              <div className="history-item-row">
                <div className="history-item-title">{task.title}</div>
              </div>
              <div className="history-item-subtitle" title={task.workspace}>
                {task.workspace.split("/").pop() || task.workspace}
              </div>
            </div>
          ))
        )}
      </div>

      {taskMenu && (
        <div
          className="task-context-menu"
          style={{ top: taskMenu.y, left: taskMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="task-context-menu-item danger"
            onClick={() => {
              const taskId = taskMenu.taskId;
              onCloseTaskMenu();
              onDeleteTask(taskId);
            }}
          >
            Delete Task
          </button>
        </div>
      )}

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
