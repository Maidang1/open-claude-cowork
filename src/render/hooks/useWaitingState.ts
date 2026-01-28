import { useCallback, useState } from "react";

export function useWaitingState() {
  const [waitingByTask, setWaitingByTask] = useState<Record<string, boolean>>({});

  const setTaskWaiting = useCallback((taskId: string, waiting: boolean) => {
    setWaitingByTask((prev) => {
      const isWaiting = Boolean(prev[taskId]);
      if (isWaiting === waiting) return prev;
      const next = { ...prev };
      if (waiting) {
        next[taskId] = true;
      } else {
        delete next[taskId];
      }
      return next;
    });
  }, []);

  const clearTaskWaitingState = useCallback((taskId: string) => {
    setWaitingByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }, []);

  return {
    waitingByTask,
    setTaskWaiting,
    clearTaskWaitingState,
  };
}
