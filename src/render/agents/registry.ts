import { QwenAgent } from "./qwen";
import { ClaudeAgent } from "./claude";
import { CodexAgent } from "./codex";
import { GeminiAgent } from "./gemini";
import type { AgentPlugin } from "./types";

export const AGENT_PLUGINS: AgentPlugin[] = [
  QwenAgent,
  ClaudeAgent,
  CodexAgent,
  GeminiAgent,
];

export const getAgentPlugin = (id: string): AgentPlugin | undefined => {
  return AGENT_PLUGINS.find((agent) => agent.id === id);
};

export const getDefaultAgentPlugin = (): AgentPlugin => {
  return AGENT_PLUGINS[0];
};
