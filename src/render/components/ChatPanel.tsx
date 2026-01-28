import type { VirtuosoHandle } from "react-virtuoso";
import type { TMessage } from "../types/messageTypes";
import { MessageList } from "./MessageList";
import { MessageRenderer } from "./MessageRenderer";

const emptyPlaceholder = (
  <div className="w-full px-4 pt-5 text-center text-muted">
    <div className="mb-2">Beginning of conversation</div>
    <div className="mx-auto h-px w-10 bg-ink-900/10" />
  </div>
);

export interface ChatPanelProps {
  /** 当前任务 ID，用于列表 key，无任务时可为 null */
  activeTaskId: string | null;
  /** 要展示的消息（含 loading 占位） */
  messages: TMessage[];
  /** 是否正在等待回复（用于 loading 条目的 onStop） */
  isWaitingForResponse: boolean;
  /** 权限确认回调 */
  onPermissionResponse: (permissionId: string, optionId: string | null, taskId?: string) => void;
  /** 停止生成 */
  onStop: () => void;
  /** Virtuoso 引用，用于滚动等 */
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  /** 是否自动跟随到底部 */
  autoFollowOutput: boolean;
  atBottomStateChange: (atBottom: boolean) => void;
  atTopStateChange: (atTop: boolean) => void;
}

export function ChatPanel({
  activeTaskId,
  messages,
  isWaitingForResponse,
  onPermissionResponse,
  onStop,
  virtuosoRef,
  autoFollowOutput,
  atBottomStateChange,
  atTopStateChange,
}: ChatPanelProps) {
  if (!activeTaskId) {
    return <div className="w-full px-4 pt-5">{emptyPlaceholder}</div>;
  }

  return (
    <MessageList<TMessage>
      key={activeTaskId}
      data={messages}
      followOutput={autoFollowOutput ? "smooth" : false}
      atBottomStateChange={atBottomStateChange}
      atTopStateChange={atTopStateChange}
      virtuosoRef={virtuosoRef}
      computeItemKey={(_, msg) => msg.id ?? 0}
      itemContent={(_, msg) => (
        <MessageRenderer
          msg={msg}
          onPermissionResponse={onPermissionResponse}
          isLoading={msg.id === "loading" && isWaitingForResponse}
          onStop={msg.id === "loading" ? onStop : undefined}
        />
      )}
      emptyPlaceholder={emptyPlaceholder}
    />
  );
}
