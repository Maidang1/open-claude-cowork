import { useCallback, useEffect, useMemo } from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import type { Task } from "../types";
import type { TMessage } from "../types/messageTypes";
import { transformMessages } from "../utils/messageTransformer";

export interface UseChatMessagesParams {
  activeTask: Task | null;
  activeTaskId: string | null;
  waitingByTask: Record<string, boolean>;
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
}

export interface UseChatMessagesResult {
  virtualMessages: TMessage[];
  isWaitingForResponse: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

export function useChatMessages({
  activeTask,
  activeTaskId,
  waitingByTask,
  virtuosoRef,
}: UseChatMessagesParams): UseChatMessagesResult {
  const isWaitingForResponse = activeTaskId ? Boolean(waitingByTask[activeTaskId]) : false;

  const renderMessages = useMemo(() => {
    if (!activeTask) return [];
    return transformMessages(activeTask.messages, activeTaskId || "default");
  }, [activeTask, activeTaskId]);

  const loadingMessage = useMemo<TMessage>(
    () => ({
      id: "loading",
      conversation_id: activeTaskId || "default",
      type: "thought",
      content: { thought: "Thinking..." },
      position: "left",
    }),
    [activeTaskId],
  );

  const virtualMessages = useMemo(() => {
    if (isWaitingForResponse) {
      return [...renderMessages, loadingMessage];
    }
    return renderMessages;
  }, [isWaitingForResponse, loadingMessage, renderMessages]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const targetIndex = virtualMessages.length - 1;
      if (targetIndex < 0) return;
      virtuosoRef.current?.scrollToIndex({
        index: targetIndex,
        align: "end",
        behavior,
      });
    },
    [virtualMessages.length, virtuosoRef],
  );

  useEffect(() => {
    setTimeout(() => scrollToBottom("auto"), 0);
  }, [activeTaskId, scrollToBottom]);

  return {
    virtualMessages,
    isWaitingForResponse,
    scrollToBottom,
  };
}
