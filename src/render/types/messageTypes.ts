// 统一消息类型定义

// 消息位置类型
export type TMessagePosition = "left" | "right" | "center" | "pop";

// 统一消息接口
export interface IMessage<T extends TMessageType, Content extends Record<string, any>> {
  id: string;
  msg_id?: string; // 用于消息合并
  conversation_id: string;
  type: T;
  content: Content;
  createdAt?: number;
  position?: TMessagePosition;
}

// 支持的消息类型
export type TMessageType =
  | "text" // 普通文本消息
  | "acp_tool_call" // ACP 工具调用
  | "acp_permission" // ACP 权限请求
  | "tool_call" // 工具调用
  | "thought" // 思考过程
  | "todo" // 待办/计划
  | "system"; // 系统消息

// 文本消息内容
export interface ITextMessageContent {
  text: string;
  images?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    dataUrl: string;
    size: number;
  }>;
  sender?: "user" | "agent" | "system";
}

// 工具调用状态
export type TToolCallStatus = "pending" | "in_progress" | "completed" | "failed";

// ACP工具调用内容
export interface IAcpToolCallContent {
  toolCallId?: string;
  name?: string;
  kind?: string;
  status?: TToolCallStatus;
  title?: string;
  description?: string;
  rawInput?: any;
  rawOutput?: any;
  update?: {
    toolCallId: string;
    status?: TToolCallStatus;
    rawInput?: any;
    rawOutput?: any;
  };
}

// ACP权限请求内容
export interface IAcpPermissionContent {
  id?: string;
  tool?: string;
  content?: string;
  options?: Array<{
    optionId: string;
    label?: string;
    name?: string;
    kind?: string;
  }>;
  command?: string;
}

// 工具调用内容
export interface IToolCallContent {
  callId?: string;
  name?: string;
  status?: TToolCallStatus;
  result?: {
    rawInput?: any;
    rawOutput?: any;
  };
}

// 思考过程内容
export interface IThoughtContent {
  thought: string;
}

// TODO 列表项
export type TTodoStatus = "todo" | "in_progress" | "done";

export interface ITodoItem {
  id?: string;
  text: string;
  status?: TTodoStatus;
  note?: string;
}

// TODO 消息内容
export interface ITodoContent {
  title?: string;
  description?: string;
  items?: ITodoItem[];
  rawText?: string;
  raw?: any;
}

// 系统消息内容
export interface ISystemContent {
  text: string;
}

// 具体消息类型定义
export type TTextMessage = IMessage<"text", ITextMessageContent>;
export type TAcpToolCallMessage = IMessage<"acp_tool_call", IAcpToolCallContent>;
export type TAcpPermissionMessage = IMessage<"acp_permission", IAcpPermissionContent>;
export type TToolCallMessage = IMessage<"tool_call", IToolCallContent>;
export type TThoughtMessage = IMessage<"thought", IThoughtContent>;
export type TTodoMessage = IMessage<"todo", ITodoContent>;
export type TSystemMessage = IMessage<"system", ISystemContent>;

// 联合类型
export type TMessage =
  | TTextMessage
  | TAcpToolCallMessage
  | TAcpPermissionMessage
  | TToolCallMessage
  | TThoughtMessage
  | TTodoMessage
  | TSystemMessage;

// 消息索引接口（用于优化合并）
export interface MessageIndex {
  msgIdIndex: Map<string, number>; // msg_id -> index
  callIdIndex: Map<string, number>; // tool_call.callId -> index
  toolCallIdIndex: Map<string, number>; // acp_tool_call.toolCallId -> index
}
