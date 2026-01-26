import type { TMessage } from "../types/messageTypes";
import { MessageAcpPermission } from "./MessageAcpPermission";
import { MessageAcpToolCall } from "./MessageAcpToolCall";
import { MessageText } from "./MessageText";
import { ThoughtDisplay } from "./ThoughtDisplay";
import { TodoMessage } from "./TodoMessage";

interface MessageRendererProps {
  msg: TMessage;
  onPermissionResponse?: (permissionId: string, optionId: string | null) => void;
  isLoading?: boolean;
  onStop?: () => void;
}

export const MessageRenderer = ({
  msg,
  onPermissionResponse,
  isLoading = false,
  onStop,
}: MessageRendererProps) => {
  const cardClassName =
    "rounded-2xl bg-surface-secondary px-2 py-2 text-sm text-ink-700 shadow-soft";
  const roleLabelClassName = "text-[14px] font-medium uppercase text-[var(--color-accent)]";
  // 权限请求消息
  if (msg.type === "acp_permission" && onPermissionResponse) {
    return (
      <div className="my-4">
        <MessageAcpPermission msg={msg} onPermissionResponse={onPermissionResponse} />
      </div>
    );
  }

  // 思考过程消息
  if (msg.type === "thought") {
    const isCenter = msg.position === "center";
    return (
      <div className={`my-3 ${!isCenter ? "text-left" : "text-center"}`}>
        <div className="flex flex-col gap-1.5">
          <div className={roleLabelClassName}>Assistant</div>
          <ThoughtDisplay
            thought={(msg.content as any).thought}
            label={msg.msg_id || msg.id}
            running={isLoading}
            onStop={onStop || (() => {})}
            style="compact"
          />
        </div>
      </div>
    );
  }

  if (msg.type === "todo") {
    const isCenter = msg.position === "center";
    return (
      <div className={`my-3 ${!isCenter ? "text-left" : "text-center"}`}>
        <div className="flex flex-col gap-1.5">
          <div className={roleLabelClassName}>Plan</div>
          <div className={cardClassName}>
            <TodoMessage content={msg.content} />
          </div>
        </div>
      </div>
    );
  }

  // ACP工具调用消息
  if (msg.type === "acp_tool_call") {
    const isCenter = msg.position === "center";
    return (
      <div className={`my-3 ${!isCenter ? "text-left" : "text-center"}`}>
        <div className="flex flex-col gap-1.5">
          <div className={roleLabelClassName}>Assistant</div>
          <MessageAcpToolCall msg={msg} />
        </div>
      </div>
    );
  }

  // 文本消息
  if (msg.type === "text") {
    const isCenter = msg.position === "center";
    const isUser = (msg.content as any).sender === "user";
    if (!isUser) {
      return (
        <div className={`my-3 ${!isCenter ? "text-left" : "text-center"}`}>
          <div className="flex flex-col gap-1.5">
            <div className={roleLabelClassName}>Assistant</div>
            <div className="text-sm text-ink-800">
              <MessageText
                content={(msg.content as any).text}
                images={(msg.content as any).images}
                sender={(msg.content as any).sender}
                align="left"
              />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={`my-3 ${!isCenter ? "text-left" : "text-center"}`}>
        <div className="flex flex-col gap-1.5">
          <div className={roleLabelClassName}>User</div>
          <div className="text-sm text-ink-800">
            <MessageText
              content={(msg.content as any).text}
              images={(msg.content as any).images}
              sender={(msg.content as any).sender}
              align="left"
            />
          </div>
        </div>
      </div>
    );
  }

  // 系统消息
  if (msg.type === "system") {
    return (
      <div className="my-3 text-left">
        <div className="flex flex-col gap-1.5">
          <div className={roleLabelClassName}>System Init</div>
          <div className={cardClassName}>
            <p>{(msg.content as any).text}</p>
          </div>
        </div>
      </div>
    );
  }

  // 默认渲染
  return (
    <div className="my-4 text-center">
      <div className="inline-block bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Unknown message type: {msg.type}</p>
      </div>
    </div>
  );
};
