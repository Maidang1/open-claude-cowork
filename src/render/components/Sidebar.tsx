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
    <div className="w-[280px] bg-sidebar border-r border-color flex flex-col p-4 flex-shrink-0 transition-colors duration-200">
      <button
        type="button"
        className="flex items-center justify-center gap-2 w-full py-3 bg-surface border border-color rounded-md text-text-primary font-semibold cursor-pointer transition-all hover:bg-surface-hover hover:border-hover hover:-translate-y-px shadow-sm mb-6"
        onClick={onNewTask}
      >
        <Plus size={16} />
        <span>New Task</span>
      </button>

      <div className="flex-1 overflow-y-auto flex flex-col gap-1 -mr-2 pr-2">
        {tasks.length === 0 ? (
          <div className="p-5 text-center text-text-tertiary text-sm italic">
            No tasks yet.
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`p-3 rounded-md cursor-pointer text-sm text-text-primary flex flex-col gap-1 transition-colors border border-transparent relative ${
                task.id === activeTaskId
                  ? "bg-primary-light dark:bg-orange-500/10 dark:border-orange-500/20"
                  : "hover:bg-surface-hover"
              }`}
              onClick={() => onSelectTask(task.id)}
            >
              <div className="flex items-center gap-2">
                <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1 pr-7">
                  {task.title}
                </div>
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 p-1 border-none bg-surface text-text-tertiary cursor-pointer rounded-md transition-all hover:bg-red-500/10 hover:text-red-500 pointer-events-none"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  aria-label="Delete task"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div
                className="text-xs text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis"
                title={task.workspace}
              >
                {task.workspace.split("/").pop() || task.workspace}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-color">
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 border border-color bg-surface text-text-primary rounded-md py-2.5 px-3 flex items-center justify-center gap-2 font-medium cursor-pointer transition-all hover:bg-surface-hover hover:border-hover"
            onClick={onOpenSettings}
            aria-label="Open settings"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className="w-auto p-2.5 border border-color bg-surface text-text-secondary rounded-md cursor-pointer transition-all hover:bg-surface-hover hover:text-text-primary"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
