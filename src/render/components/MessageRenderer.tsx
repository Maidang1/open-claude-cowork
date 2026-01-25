import type { TMessage } from "../types/messageTypes";
import { MessageAcpPermission } from "./MessageAcpPermission";
import { MessageAcpToolCall } from "./MessageAcpToolCall";
import { MessageText } from "./MessageText";
import { ThoughtDisplay } from "./ThoughtDisplay";

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
    const isUser = msg.type === "text" && (msg.content as any).sender === "user";
    return (
      <div className={`my-4 ${!isCenter ? (isUser ? "text-right" : "text-left") : "text-center"}`}>
        <ThoughtDisplay
          thought={(msg.content as any).thought}
          running={isLoading}
          onStop={onStop || (() => {})}
        />
      </div>
    );
  }

  // ACP工具调用消息
  if (msg.type === "acp_tool_call") {
    const isCenter = msg.position === "center";
    const isUser = msg.type === "text" && (msg.content as any).sender === "user";
    return (
      <div className={`my-4 ${!isCenter ? (isUser ? "text-right" : "text-left") : "text-center"}`}>
        <MessageAcpToolCall msg={msg} />
      </div>
    );
  }

  // 文本消息
  if (msg.type === "text") {
    const isCenter = msg.position === "center";
    const isUser = (msg.content as any).sender === "user";
    if (!isUser) {
      return (
        <div className={`my-4 ${!isCenter ? "text-left" : "text-center"}`}>
          <div className="max-w-[720px]">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              Assistant
            </div>
            <div className="mt-2 h-px w-full bg-[color:var(--border-color)]" />
            <div className="mt-2 text-sm text-text-primary">
              <MessageText
                content={(msg.content as any).text}
                images={(msg.content as any).images}
                sender={(msg.content as any).sender}
              />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={`my-4 ${!isCenter ? (isUser ? "text-right" : "text-left") : "text-center"}`}>
        <div
          className={`inline-block ${isUser ? "bg-primary text-white" : "bg-surface border border-color"} rounded-lg p-4 max-w-[80%]`}
        >
          <MessageText
            content={(msg.content as any).text}
            images={(msg.content as any).images}
            sender={(msg.content as any).sender}
          />
        </div>
      </div>
    );
  }

  // 系统消息
  if (msg.type === "system") {
    return (
      <div className="my-4 text-center">
        <div className="inline-block bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-w-[80%]">
          <p className="text-sm text-gray-600 dark:text-gray-400">{(msg.content as any).text}</p>
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
