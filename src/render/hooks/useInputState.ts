import { useCallback, useState } from "react";
import type { ImageAttachment } from "../types";

export function useInputState() {
  const [inputTextByTask, setInputTextByTask] = useState<Record<string, string>>({});
  const [inputImagesByTask, setInputImagesByTask] = useState<Record<string, ImageAttachment[]>>(
    {},
  );

  const setCurrentInputText = useCallback(
    (activeTaskId: string | null, value: string) => {
      if (!activeTaskId) return;
      setInputTextByTask((prev) => ({ ...prev, [activeTaskId]: value }));
    },
    [],
  );

  const setCurrentInputImages = useCallback(
    (activeTaskId: string | null, images: ImageAttachment[]) => {
      if (!activeTaskId) return;
      setInputImagesByTask((prev) => ({ ...prev, [activeTaskId]: images }));
    },
    [],
  );

  const appendCurrentInputImages = useCallback(
    (activeTaskId: string | null, images: ImageAttachment[]) => {
      if (!activeTaskId) return;
      setInputImagesByTask((prev) => {
        const existing = prev[activeTaskId] ?? [];
        return { ...prev, [activeTaskId]: [...existing, ...images] };
      });
    },
    [],
  );

  const clearTaskInputState = useCallback((taskId: string) => {
    setInputTextByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setInputImagesByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }, []);

  return {
    inputTextByTask,
    inputImagesByTask,
    setCurrentInputText,
    setCurrentInputImages,
    appendCurrentInputImages,
    clearTaskInputState,
  };
}
