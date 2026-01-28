import { Check, ChevronLeft, ChevronRight, Edit2, Plus, Settings, Trash2, X } from "lucide-react";
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
  theme: "light" | "dark" | "auto";
  onThemeChange: (theme: "light" | "dark" | "auto") => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar = ({
  tasks,
  activeTaskId,
  onNewTask,
  onSelectTask,
  onDeleteTask,
  onRenameTask,
  onOpenSettings,
  collapsed,
  onToggleCollapse,
}: SidebarProps) => {
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
    <aside
      className={`fixed inset-y-0 left-0 flex h-full flex-col gap-4 border-r border-ink-900/5 bg-surface-cream pb-4 pt-[40px] transition-all ${
        collapsed ? "w-[72px] px-2" : "w-[280px] px-4"
      }`}
    >
      <div className={collapsed ? "flex flex-col gap-2" : "flex gap-2"}>
        {collapsed ? (
          <button
            type="button"
            className="flex items-center justify-center rounded-xl border border-ink-900/10 bg-surface px-3 py-2.5 text-ink-700 transition-colors hover:bg-surface-tertiary hover:border-ink-900/20"
            onClick={onToggleCollapse}
            aria-label="展开侧边栏"
          >
            <ChevronRight size={16} />
          </button>
        ) : (
          <>
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
            <button
              type="button"
              className="rounded-xl border border-ink-900/10 bg-surface px-3 py-2.5 text-ink-700 transition-colors hover:bg-surface-tertiary hover:border-ink-900/20"
              onClick={onToggleCollapse}
              aria-label="收起侧边栏"
            >
              <ChevronLeft size={14} />
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 -mr-2 pr-2">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-ink-900/5 bg-surface px-4 py-5 text-center text-xs text-muted">
              No tasks yet. Click "New Task" to start.
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`cursor-pointer rounded-2xl border px-4 py-4 text-left transition relative ${
                  task.id === activeTaskId
                    ? "border-accent/30 bg-accent-subtle"
                    : "border-ink-900/5 bg-surface hover:bg-surface-tertiary"
                }`}
                onClick={() => onSelectTask(task.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
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
                      <div className="font-medium text-ink-800 text-sm mb-1">{task.title}</div>
                    )}
                    <div className="text-xs text-muted" title={task.workspace}>
                      {task.workspace.split("/").pop() || task.workspace}
                    </div>
                  </div>
                  {editingTaskId === task.id ? (
                    <div className="flex gap-1 ml-2">
                      <button
                        type="button"
                        className="rounded-md p-1 text-ink-500 transition-all hover:bg-green-500/10 hover:text-green-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSaveRename(task.id);
                        }}
                        aria-label="Save task name"
                      >
                        <Check size={14} />
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
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 ml-2">
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
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
