import { useCallback, useRef, useState } from "react";
import type { Task } from "../types";

export function useTaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const tasksRef = useRef<Task[]>([]);
  const activeTaskIdRef = useRef<string | null>(null);

  const persistTaskUpdates = useCallback((taskId: string, updates: Partial<Task>) => {
    window.electron.invoke("db:update-task", taskId, updates);
  }, []);

  const applyTaskUpdates = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      setTasks((prev) => {
        const next = prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
        return [...next].sort((a, b) => b.createdAt - a.createdAt);
      });
      persistTaskUpdates(taskId, updates);
    },
    [persistTaskUpdates],
  );

  const clearTaskSessionId = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, sessionId: null } : task)),
      );
      persistTaskUpdates(taskId, { sessionId: null });
    },
    [persistTaskUpdates],
  );

  const createTaskId = () => {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  return {
    tasks,
    setTasks,
    activeTaskId,
    setActiveTaskId,
    tasksRef,
    activeTaskIdRef,
    persistTaskUpdates,
    applyTaskUpdates,
    clearTaskSessionId,
    createTaskId,
  };
}
