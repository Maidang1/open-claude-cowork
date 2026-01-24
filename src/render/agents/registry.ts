import { ACP_BACKENDS_ALL } from "@src/types/acpTypes";
import type { AgentPlugin } from "./types";

export const AGENT_PLUGINS: AgentPlugin[] = [...ACP_BACKENDS_ALL];

export const getAgentPlugin = (id: string): AgentPlugin | undefined => {
  return AGENT_PLUGINS.find((agent) => agent.id === id);
};

export const getDefaultAgentPlugin = (): AgentPlugin => {
  return AGENT_PLUGINS[0];
};
