import type { Message } from "../../types";
import type {
  TAcpPermissionMessage,
  TAcpToolCallMessage,
  TMessage,
  TSystemMessage,
  TTextMessage,
  TThoughtMessage,
  TTodoMessage,
} from "../../types/messageTypes";

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

    // TODO/todoWrite 消息
    if ((msg as any).todo) {
      const todoPayload = (msg as any).todo;
      const todoMsg: TTodoMessage = {
        id: msg.id,
        msg_id: msg.msgId,
        conversation_id: conversationId,
        type: "todo",
        content: {
          ...todoPayload,
          rawText: todoPayload?.rawText ?? msg.content,
        },
        position: "left",
      };
      return todoMsg;
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
