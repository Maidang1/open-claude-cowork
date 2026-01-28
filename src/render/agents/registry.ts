import { ACP_BACKENDS_ALL } from "@src/types/acpTypes";
import type { AgentPlugin } from "./types";

const CLAUDE_SDK_PLUGIN: AgentPlugin = {
  id: "claude-sdk",
  name: "Claude SDK",
  description: "Claude Agent SDK (non-ACP) provider.",
  defaultCommand: "claude-sdk",
  icon: "claude",
};

export const AGENT_PLUGINS: AgentPlugin[] = [...ACP_BACKENDS_ALL, CLAUDE_SDK_PLUGIN];

export const getAgentPlugin = (id: string): AgentPlugin | undefined => {
  return AGENT_PLUGINS.find((agent) => agent.id === id);
};

export const getDefaultAgentPlugin = (): AgentPlugin => {
  return AGENT_PLUGINS[0];
};
