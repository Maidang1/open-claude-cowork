import type { Message, ToolCall } from "../types";
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
      msg_id: msg.msgId,
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
      msg_id: msg.msgId,
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
      msg_id: msg.msgId,
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
        msg_id: msg.msgId,
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
        msg_id: msg.msgId,
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
      msg_id: msg.msgId,
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
    msg_id: msg.msgId,
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
              msg.content.rawInput ?? msg.content.update?.rawInput ?? fallbackTool?.result?.rawInput,
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
    return prev ?? {
      id: "unknown",
      sender: "system",
      content: "",
    };
  });
}
