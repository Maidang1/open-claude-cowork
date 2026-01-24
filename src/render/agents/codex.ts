import type { AgentPlugin } from "./types";

export const CodexAgent: AgentPlugin = {
  id: "codex",
  name: "Codex Agent",
  description: "Codex agent with ACP protocol support using @zed-industries/codex-acp.",
  packageSpec: "@zed-industries/codex-acp",
  defaultCommand: "npx @zed-industries/codex-acp",
  checkCommand: "npx",
  defaultEnv: {},
};
