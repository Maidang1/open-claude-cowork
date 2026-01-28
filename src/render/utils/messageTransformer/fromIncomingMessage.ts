import type { TMessage } from "../../types/messageTypes";

// 将 IncomingMessage 转换为新的统一消息类型
export function transformIncomingMessage(
  incomingMsg: any,
  conversationId: string,
  options?: { id?: string; msgId?: string },
): TMessage {
  const id = options?.id || Date.now().toString();
  const msgId = options?.msgId;

  switch (incomingMsg.type) {
    case "agent_text":
      return {
        id,
        msg_id: msgId,
        conversation_id: conversationId,
        type: "text",
        content: {
          text: incomingMsg.text || "",
          sender: "agent",
        },
        position: "left",
      };

    case "agent_thought":
      return {
        id,
        msg_id: msgId,
        conversation_id: conversationId,
        type: "thought",
        content: {
          thought: incomingMsg.text || "",
        },
        position: "left",
      };

    case "todoWrite":
    case "agent_todo":
    case "todo":
      return {
        id,
        msg_id: msgId,
        conversation_id: conversationId,
        type: "todo",
        content: {
          title: incomingMsg.title,
          description: incomingMsg.description,
          items: incomingMsg.items,
          rawText: incomingMsg.text,
          raw: incomingMsg,
        },
        position: "left",
      };

    case "tool_call":
      return {
        id,
        msg_id: msgId,
        conversation_id: conversationId,
        type: "acp_tool_call",
        content: {
          toolCallId:
            incomingMsg.toolCallId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          name: incomingMsg.name || "Unknown Tool",
          kind: incomingMsg.kind,
          status: incomingMsg.status || "in_progress",
          rawInput: incomingMsg.rawInput,
          rawOutput: incomingMsg.rawOutput,
        },
        position: "left",
      };

    case "tool_call_update":
      return {
        id,
        msg_id: msgId,
        conversation_id: conversationId,
        type: "acp_tool_call",
        content: {
          update: {
            toolCallId: incomingMsg.toolCallId,
            status: incomingMsg.status,
            rawInput: incomingMsg.rawInput,
            rawOutput: incomingMsg.rawOutput,
          },
        },
        position: "left",
      };

    case "permission_request":
      return {
        id,
        msg_id: msgId,
        conversation_id: conversationId,
        type: "acp_permission",
        content: {
          id: incomingMsg.id,
          tool: incomingMsg.tool,
          content: incomingMsg.content || incomingMsg.text,
          options: incomingMsg.options?.map((opt: any) => ({
            optionId: opt.optionId,
            label: opt.label || opt.name || opt.kind,
          })),
          command: incomingMsg.command,
        },
        position: "center",
      };

    case "system":
      return {
        id,
        msg_id: msgId,
        conversation_id: conversationId,
        type: "system",
        content: {
          text: incomingMsg.text || "",
        },
        position: "center",
      };

    default:
      return {
        id,
        msg_id: msgId,
        conversation_id: conversationId,
        type: "text",
        content: {
          text: incomingMsg.text || "Unknown message type",
          sender: "system",
        },
        position: "center",
      };
  }
}
