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
    | "agent_plan"
    | "agent_status";
  text?: string;
  toolCallId?: string;
  id?: string;
  name?: string;
  kind?: string;
  status?: string;
  options?: any[];
  tool?: string;
  content?: string;
  info?: Partial<AgentInfoState>;
  sessionId?: string;
  plan?: any;
  rawInput?: any;
  rawOutput?: any;
  taskId?: string;
}
