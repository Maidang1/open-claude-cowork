import type { Message } from "../types";
import type {
  TAcpPermissionMessage,
  TAcpToolCallMessage,
  TMessage,
  TSystemMessage,
  TTextMessage,
  TThoughtMessage,
} from "../types/messageTypes";

// 将现有消息类型转换为新的统一消息类型
export function transformToNewMessage(msg: Message, conversationId: string): TMessage {
  // 权限请求消息
  if (msg.permissionId) {
    const acpPermissionMsg: TAcpPermissionMessage = {
      id: msg.id,
      conversation_id: conversationId,
      type: "acp_permission",
      content: {
        id: msg.permissionId,
        content: msg.content,
        options: msg.options,
      },
      position: "center",
    };
    return acpPermissionMsg;
  }

  // 系统消息
  if (msg.sender === "system") {
    const systemMsg: TSystemMessage = {
      id: msg.id,
      conversation_id: conversationId,
      type: "system",
      content: {
        text: msg.content,
      },
      position: "center",
    };
    return systemMsg;
  }

  // 用户消息
  if (msg.sender === "user") {
    const textMsg: TTextMessage = {
      id: msg.id,
      conversation_id: conversationId,
      type: "text",
      content: {
        text: msg.content,
        images: msg.images,
        sender: "user",
      },
      position: "right",
    };
    return textMsg;
  }

  // AI消息 - 根据内容类型进行转换
  if (msg.sender === "agent") {
    // 只有思考过程的消息
    if (msg.thought && !msg.content && (!msg.toolCalls || msg.toolCalls.length === 0)) {
      const thoughtMsg: TThoughtMessage = {
        id: msg.id,
        conversation_id: conversationId,
        type: "thought",
        content: {
          thought: msg.thought,
        },
        position: "left",
      };
      return thoughtMsg;
    }

    // 只有工具调用的消息
    if (msg.toolCalls && msg.toolCalls.length > 0 && !msg.content && !msg.thought) {
      const toolCallMsg: TAcpToolCallMessage = {
        id: msg.id,
        conversation_id: conversationId,
        type: "acp_tool_call",
        content: {
          toolCallId: msg.toolCalls[0].id,
          name: msg.toolCalls[0].name,
          kind: msg.toolCalls[0].kind,
          status: msg.toolCalls[0].status,
          rawInput: msg.toolCalls[0].result?.rawInput,
          rawOutput: msg.toolCalls[0].result?.rawOutput,
        },
        position: "left",
      };
      return toolCallMsg;
    }

    // 默认文本消息
    const textMsg: TTextMessage = {
      id: msg.id,
      conversation_id: conversationId,
      type: "text",
      content: {
        text: msg.content,
        sender: "agent",
      },
      position: "left",
    };
    return textMsg;
  }

  // 默认文本消息
  const defaultMsg: TTextMessage = {
    id: msg.id,
    conversation_id: conversationId,
    type: "text",
    content: {
      text: msg.content,
      sender: msg.sender || "system",
    },
    position: msg.sender === "user" ? "right" : "left",
  };
  return defaultMsg;
}

// 批量转换消息
export function transformMessages(messages: Message[], conversationId: string): TMessage[] {
  return messages.map((msg) => transformToNewMessage(msg, conversationId));
}

// 将 IncomingMessage 转换为新的统一消息类型
export function transformIncomingMessage(
  incomingMsg: any,
  conversationId: string,
  msgId?: string,
): TMessage {
  switch (incomingMsg.type) {
    case "agent_text":
      return {
        id: msgId || Date.now().toString(),
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
        id: msgId || Date.now().toString(),
        conversation_id: conversationId,
        type: "thought",
        content: {
          thought: incomingMsg.text || "",
        },
        position: "left",
      };

    case "tool_call":
      return {
        id: msgId || Date.now().toString(),
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
        id: msgId || Date.now().toString(),
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
        id: msgId || Date.now().toString(),
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
        id: msgId || Date.now().toString(),
        conversation_id: conversationId,
        type: "system",
        content: {
          text: incomingMsg.text || "",
        },
        position: "center",
      };

    default:
      return {
        id: msgId || Date.now().toString(),
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
