// Shared types between main and render processes

export interface ToolCall {
  id: string;
  name: string;
  kind?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: any;
}

export interface AgentModelInfo {
  modelId: string;
  name: string;
  description?: string | null;
}

export interface AgentCommandInfo {
  name: string;
  description?: string | null;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AgentInfoState {
  models: AgentModelInfo[];
  currentModelId: string | null;
  commands: AgentCommandInfo[];
  tokenUsage: TokenUsage | null;
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
}

export interface IncomingMessage {
  type:
    | "agent_text"
    | "agent_thought"
    | "agent_info"
    | "tool_call"
    | "tool_call_update"
    | "tool_log"
    | "system"
    | "permission_request"
    | "agent_plan";
  text?: string;
  toolCallId?: string;
  id?: string;
  name?: string;
  kind?: string;
  status?: string;
  options?: any[];
  tool?: string;
  info?: Partial<AgentInfoState>;
  sessionId?: string;
  plan?: any;
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
