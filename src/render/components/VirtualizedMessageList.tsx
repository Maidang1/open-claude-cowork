import { forwardRef, useMemo, useRef } from "react";
import { type Components, Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { TMessage } from "../types/messageTypes";
import { MessageRenderer } from "./MessageRenderer";

interface VirtualizedMessageListProps {
  messages: TMessage[];
  onPermissionResponse?: (permissionId: string, optionId: string | null) => void;
  isLoading?: boolean;
  onStop?: () => void;
}

// Move List component outside to prevent re-creation on every render
const ListContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div
      {...props}
      ref={ref}
      className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 pb-28 pt-5"
    />
  ),
);

export const VirtualizedMessageList = ({
  messages,
  onPermissionResponse,
  isLoading = false,
  onStop,
}: VirtualizedMessageListProps) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Memoize components to prevent Virtuoso re-renders
  const components = useMemo<Components<TMessage>>(
    () => ({
      List: ListContainer,
      Header: () =>
        messages.length === 0 ? (
          <div className="text-center text-muted mt-10">
            <div className="mb-2">Beginning of conversation</div>
            <div className="mx-auto h-px w-10 bg-ink-900/10" />
          </div>
        ) : null,
      Footer: () =>
        isLoading ? (
          <MessageRenderer
            msg={{
              id: "loading",
              conversation_id: "loading",
              type: "thought",
              content: {
                thought: "Thinking...",
              },
              position: "left",
            }}
            isLoading
            onStop={onStop}
          />
        ) : (
          <div className="h-4" />
        ),
    }),
    [messages.length, isLoading, onStop],
  );

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={{ height: "100%", width: "100%" }}
      data={messages}
      initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : undefined}
      followOutput="auto"
      alignToBottom={messages.length > 0}
      increaseViewportBy={200}
      className="bg-surface-cream no-scrollbar"
      itemContent={(_index, msg) => (
        <div className="w-full">
          <MessageRenderer msg={msg} onPermissionResponse={onPermissionResponse} />
        </div>
      )}
      components={components}
    />
  );
};
