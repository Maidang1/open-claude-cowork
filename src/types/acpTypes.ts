export const ACP_METHODS = {
  sessionUpdate: "session/update",
  sessionRequestPermission: "session/request_permission",
  fsReadTextFile: "fs/read_text_file",
  fsWriteTextFile: "fs/write_text_file",
} as const;

export interface AgentPlugin {
  id: string;
  name: string;
  description: string;
  packageSpec?: string;
  defaultCommand: string;
  checkCommand?: string;
  defaultEnv?: Record<string, string>;
  icon?: string; // Icon key used by @lobehub/icons.
}

export const ACP_BACKENDS_ALL: AgentPlugin[] = [
  {
    id: "qwen",
    name: "Qwen Agent",
    description: "Official Qwen agent with ACP protocol support.",
    packageSpec: "@qwen-code/qwen-code",
    defaultCommand:
      "qwen --acp --allowed-tools all,run_shell_command --experimental-skills",
    checkCommand: "qwen",
    defaultEnv: {},
    icon: "qwen",
  },
  {
    id: "claude",
    name: "Claude Agent",
    description:
      "Claude agent with ACP protocol support using @zed-industries/claude-code-acp.",
    packageSpec: "@zed-industries/claude-code-acp",
    defaultCommand: "npx @zed-industries/claude-code-acp",
    checkCommand: "npx",
    defaultEnv: {},
    icon: "claude",
  },
  {
    id: "codex",
    name: "Codex Agent",
    description:
      "Codex agent with ACP protocol support using @zed-industries/codex-acp.",
    packageSpec: "@zed-industries/codex-acp",
    defaultCommand: "npx @zed-industries/codex-acp",
    checkCommand: "npx",
    defaultEnv: {},
    icon: "openai",
  },
  {
    id: "gemini",
    name: "Gemini Agent",
    description: "Official Gemini agent with ACP protocol support.",
    packageSpec: "@google/gemini-code",
    defaultCommand:
      "gemini --acp --allowed-tools all,run_shell_command --experimental-skills",
    checkCommand: "gemini",
    defaultEnv: {},
    icon: "gemini",
  },
];

export const POTENTIAL_ACP_CLIS = Array.from(
  new Set(
    ACP_BACKENDS_ALL.map(
      (backend) => backend.checkCommand || backend.defaultCommand.split(" ")[0],
    ).filter(Boolean),
  ),
);

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
}
