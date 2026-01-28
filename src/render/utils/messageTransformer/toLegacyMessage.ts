import type { Message, ToolCall } from "../../types";
import type { TMessage, TTodoMessage } from "../../types/messageTypes";

const resolveSender = (msg: TMessage, fallback?: Message) => {
  if (msg.type === "text" && msg.content?.sender) {
    return msg.content.sender;
  }
  if (fallback?.sender) {
    return fallback.sender;
  }
  if (msg.position === "right") return "user";
  if (msg.position === "left") return "agent";
  return "system";
};

const toToolCallStatus = (status?: string): ToolCall["status"] => {
  if (
    status === "pending" ||
    status === "in_progress" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }
  return "in_progress";
};

export function transformToLegacyMessages(
  messages: TMessage[],
  previousLegacy: Message[] = [],
): Message[] {
  const prevById = new Map(previousLegacy.map((msg) => [msg.id, msg]));

  return messages.map((msg) => {
    const prev = prevById.get(msg.id);
    switch (msg.type) {
      case "system":
        return {
          id: msg.id,
          msgId: msg.msg_id ?? prev?.msgId,
          sender: "system",
          content: msg.content.text || "",
        };
      case "acp_permission":
        return {
          id: msg.id,
          msgId: msg.msg_id ?? prev?.msgId,
          sender: "system",
          content: msg.content.content || msg.content.tool || "Permission request",
          permissionId: msg.content.id || prev?.permissionId,
          options: msg.content.options || prev?.options,
        };
      case "thought":
        return {
          id: msg.id,
          msgId: msg.msg_id ?? prev?.msgId,
          sender: "agent",
          content: "",
          thought: msg.content.thought || "",
          tokenUsage: prev?.tokenUsage,
        };
      case "todo":
        return {
          id: msg.id,
          msgId: msg.msg_id ?? prev?.msgId,
          sender: "agent",
          content: msg.content.rawText || msg.content.description || prev?.content || "",
          tokenUsage: prev?.tokenUsage,
          todo: msg.content,
        } as Message & { todo?: TTodoMessage["content"] };
      case "acp_tool_call": {
        const fallbackTool = prev?.toolCalls?.[0];
        const toolCallId = msg.content.toolCallId || msg.content.update?.toolCallId;
        const tool: ToolCall = {
          id: toolCallId || fallbackTool?.id || msg.id,
          name: msg.content.name || msg.content.title || fallbackTool?.name || "Unknown Tool",
          kind: msg.content.kind || fallbackTool?.kind,
          status: toToolCallStatus(msg.content.status || msg.content.update?.status),
          result: {
            rawInput:
              msg.content.rawInput ??
              msg.content.update?.rawInput ??
              fallbackTool?.result?.rawInput,
            rawOutput:
              msg.content.rawOutput ??
              msg.content.update?.rawOutput ??
              fallbackTool?.result?.rawOutput,
          },
        };
        return {
          id: msg.id,
          msgId: msg.msg_id ?? prev?.msgId,
          sender: "agent",
          content: "",
          toolCalls: [tool],
          tokenUsage: prev?.tokenUsage,
        };
      }
      case "tool_call": {
        const fallbackTool = prev?.toolCalls?.[0];
        const tool: ToolCall = {
          id: msg.content.callId || fallbackTool?.id || msg.id,
          name: msg.content.name || fallbackTool?.name || "Unknown Tool",
          status: toToolCallStatus(msg.content.status || fallbackTool?.status),
          result: {
            rawInput: msg.content.result?.rawInput ?? fallbackTool?.result?.rawInput,
            rawOutput: msg.content.result?.rawOutput ?? fallbackTool?.result?.rawOutput,
          },
        };
        return {
          id: msg.id,
          msgId: msg.msg_id ?? prev?.msgId,
          sender: "agent",
          content: "",
          toolCalls: [tool],
          tokenUsage: prev?.tokenUsage,
        };
      }
      case "text": {
        const sender = resolveSender(msg, prev);
        return {
          id: msg.id,
          msgId: msg.msg_id ?? prev?.msgId,
          sender,
          content: msg.content.text || "",
          images: msg.content.images,
          tokenUsage: prev?.tokenUsage,
        };
      }
    }
    return (
      prev ?? {
        id: "unknown",
        sender: "system",
        content: "",
      }
    );
  });
}
