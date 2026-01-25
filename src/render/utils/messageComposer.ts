import type { MessageIndex, TMessage } from "../types/messageTypes";

// 构建消息索引
export function buildMessageIndex(list: TMessage[]): MessageIndex {
  const msgIdIndex = new Map<string, number>();
  const callIdIndex = new Map<string, number>();
  const toolCallIdIndex = new Map<string, number>();

  list.forEach((msg, index) => {
    if (msg.msg_id) {
      msgIdIndex.set(msg.msg_id, index);
    }
    if (msg.type === "tool_call" && msg.content.callId) {
      callIdIndex.set(msg.content.callId, index);
    }
    if (msg.type === "acp_tool_call" && msg.content.toolCallId) {
      toolCallIdIndex.set(msg.content.toolCallId, index);
    }
  });

  return {
    msgIdIndex,
    callIdIndex,
    toolCallIdIndex,
  };
}

// 替换消息
export function replaceMessage(list: TMessage[], index: number, updated: TMessage): TMessage[] {
  const newList = [...list];
  newList[index] = updated;
  return newList;
}

// 消息合并策略
export function composeMessage(list: TMessage[], newMsg: TMessage): TMessage[] {
  const index = buildMessageIndex(list);

  // ACP工具调用更新
  if (newMsg.type === "acp_tool_call" && newMsg.content?.update?.toolCallId) {
    const existingIdx = index.toolCallIdIndex.get(newMsg.content.update.toolCallId);
    if (existingIdx !== undefined) {
      const existingMsg = list[existingIdx];
      const merged = { ...existingMsg.content, ...newMsg.content };
      const updated = { ...existingMsg, content: merged };
      return replaceMessage(list, existingIdx, updated);
    }
  }

  // 工具调用更新
  if (newMsg.type === "tool_call" && newMsg.content.callId) {
    const existingIdx = index.callIdIndex.get(newMsg.content.callId);
    if (existingIdx !== undefined) {
      const existingMsg = list[existingIdx];
      const merged = { ...existingMsg.content, ...newMsg.content };
      const updated = { ...existingMsg, content: merged };
      return replaceMessage(list, existingIdx, updated);
    }
  }

  // 消息ID匹配更新
  if (newMsg.msg_id) {
    const existingIdx = index.msgIdIndex.get(newMsg.msg_id);
    if (existingIdx !== undefined) {
      const existingMsg = list[existingIdx];
      if (existingMsg.type === "text" && newMsg.type === "text") {
        const merged = {
          ...existingMsg.content,
          ...newMsg.content,
          text: `${existingMsg.content.text || ""}${newMsg.content.text || ""}`,
        };
        const updated = { ...existingMsg, content: merged };
        return replaceMessage(list, existingIdx, updated);
      }

      if (existingMsg.type === "thought" && newMsg.type === "thought") {
        const merged = {
          ...existingMsg.content,
          ...newMsg.content,
          thought: `${existingMsg.content.thought || ""}${newMsg.content.thought || ""}`,
        };
        const updated = { ...existingMsg, content: merged };
        return replaceMessage(list, existingIdx, updated);
      }

      const merged = { ...existingMsg.content, ...newMsg.content };
      const updated = { ...existingMsg, content: merged };
      return replaceMessage(list, existingIdx, updated);
    }
  }

  // 默认添加新消息
  return [...list, newMsg];
}

// 消息合并工具类
export class MessageComposer {
  private messages: TMessage[] = [];

  constructor(initialMessages: TMessage[] = []) {
    this.messages = initialMessages;
  }

  // 添加单个消息
  public addMessage(msg: TMessage): TMessage[] {
    this.messages = composeMessage(this.messages, msg);
    return [...this.messages];
  }

  // 添加多个消息
  public addMessages(msgs: TMessage[]): TMessage[] {
    msgs.forEach((msg) => {
      this.messages = composeMessage(this.messages, msg);
    });
    return [...this.messages];
  }

  // 获取所有消息
  public getMessages(): TMessage[] {
    return [...this.messages];
  }

  // 清空所有消息
  public clear(): TMessage[] {
    this.messages = [];
    return [...this.messages];
  }
}
