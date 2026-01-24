import { QwenAgent } from "./qwen";
import type { AgentPlugin } from "./types";

export const AGENT_PLUGINS: AgentPlugin[] = [
  QwenAgent,
  // Add more agents here
];

export const getAgentPlugin = (id: string): AgentPlugin | undefined => {
  return AGENT_PLUGINS.find((agent) => agent.id === id);
};

export const getDefaultAgentPlugin = (): AgentPlugin => {
  return AGENT_PLUGINS[0];
};
