import type {
  AgentCommandInfo,
  AgentInfoState,
  AgentModelInfo,
  IncomingMessage,
  TokenUsage,
} from "@src/types/acpTypes";

export type { AgentCommandInfo, AgentInfoState, AgentModelInfo, IncomingMessage, TokenUsage };

// Shared types between main and render processes

export interface ToolCall {
  id: string;
  name: string;
  kind?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: {
    rawInput?: any;
    rawOutput?: any;
  };
}

export interface ImageAttachment {
  id: string;
  filename: string;
  mimeType: string;
  dataUrl: string; // Base64 编码的图片数据
  size: number;
}

export interface Message {
  id: string;
  sender: "user" | "agent" | "system";
  content: string;
  thought?: string;
  toolCalls?: ToolCall[];
  tokenUsage?: TokenUsage;
  permissionId?: string;
  options?: any[];
  images?: ImageAttachment[];
}

export interface Task {
  id: string;
  title: string;
  workspace: string;
  agentCommand: string;
  agentEnv: Record<string, string>;
  messages: Message[];
  sessionId: string | null;
  modelId: string | null;
  tokenUsage: TokenUsage | null;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
}

export interface ConnectionStatus {
  state: "connecting" | "connected" | "error" | "disconnected";
  message: string;
}

export type NodeRuntimePreference = "bundled" | "custom";
