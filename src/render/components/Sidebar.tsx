import { Plus } from "lucide-react";
import { useState } from "react";
import type { Task } from "../types";

interface SidebarProps {
  tasks: Task[];
  activeTaskId: string | null;
  onNewTask: () => void;
  onSelectTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRenameTask: (taskId: string, newTitle: string) => void;
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
  onRenameTask,
  onOpenSettings,
  theme,
  onToggleTheme,
}: SidebarProps) => {
  const { Moon, Sun, Settings, Trash2, Edit2 } = require("lucide-react");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleStartRename = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
  };

  const handleSaveRename = (taskId: string) => {
    if (editTitle.trim()) {
      onRenameTask(taskId, editTitle.trim());
    }
    setEditingTaskId(null);
  };

  const handleCancelRename = () => {
    setEditingTaskId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, taskId: string, originalTitle: string) => {
    if (e.key === "Enter") {
      handleSaveRename(taskId);
    } else if (e.key === "Escape") {
      setEditTitle(originalTitle);
      handleCancelRename();
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 flex h-full w-[280px] flex-col gap-4 border-r border-ink-900/5 bg-surface-cream px-4 pb-4 pt-12">
      <div className="absolute top-0 left-0 right-0 h-12" style={{ WebkitAppRegion: "drag" }} />
      <div className="flex gap-2">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-tertiary hover:border-ink-900/20"
          onClick={onNewTask}
        >
          <Plus size={14} />
          <span>New Task</span>
        </button>
        <button
          type="button"
          className="rounded-xl border border-ink-900/10 bg-surface px-3 py-2.5 text-ink-700 transition-colors hover:bg-surface-tertiary hover:border-ink-900/20"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          <Settings size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2 -mr-2 pr-2">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-ink-900/5 bg-surface px-4 py-5 text-center text-xs text-muted">
            No tasks yet. Click "New Task" to start.
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition relative ${
                task.id === activeTaskId
                  ? "border-accent/30 bg-accent-subtle"
                  : "border-ink-900/5 bg-surface hover:bg-surface-tertiary"
              }`}
              onClick={() => onSelectTask(task.id)}
            >
              <div className="flex items-center gap-2">
                {editingTaskId === task.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, task.id, task.title)}
                    onBlur={() => handleSaveRename(task.id)}
                    className="flex-1 rounded-lg border border-ink-900/10 bg-surface px-2 py-1 text-sm text-ink-700 focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                  />
                ) : (
                  <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1 pr-12 text-ink-800 text-[12px]">
                    {task.title}
                  </div>
                )}
                {editingTaskId === task.id ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      className="rounded-md p-1 text-ink-500 transition-all hover:bg-green-500/10 hover:text-green-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSaveRename(task.id);
                      }}
                      aria-label="Save task name"
                    >
                      {/* Check icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1 text-ink-500 transition-all hover:bg-red-500/10 hover:text-red-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCancelRename();
                      }}
                      aria-label="Cancel task name"
                    >
                      {/* X icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      className="rounded-md p-1 text-ink-500 transition-all hover:bg-ink-900/10 hover:text-ink-700"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStartRename(task);
                      }}
                      aria-label="Edit task name"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1 text-ink-500 transition-all hover:bg-red-500/10 hover:text-red-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteTask(task.id);
                      }}
                      aria-label="Delete task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div
                className="text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis"
                title={task.workspace}
              >
                {task.workspace.split("/").pop() || task.workspace}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-ink-900/5 pt-3">
        <span className="text-xs text-muted">Theme</span>
        <button
          type="button"
          className="rounded-full border border-ink-900/10 bg-surface p-2 text-ink-600 transition-colors hover:bg-surface-tertiary hover:text-ink-800"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>
    </aside>
  );
};
