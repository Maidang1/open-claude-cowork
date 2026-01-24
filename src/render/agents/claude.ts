import type { AgentPlugin } from "./types";

export const ClaudeAgent: AgentPlugin = {
  id: "claude",
  name: "Claude Agent",
  description: "Claude agent with ACP protocol support using @zed-industries/codex-acp.",
  packageSpec: "@zed-industries/codex-acp",
  defaultCommand: "npx @zed-industries/codex-acp",
  checkCommand: "npx",
  defaultEnv: {},
};
