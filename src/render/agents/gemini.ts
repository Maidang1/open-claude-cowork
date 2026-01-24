import type { AgentPlugin } from "./types";

export const GeminiAgent: AgentPlugin = {
  id: "gemini",
  name: "Gemini Agent",
  description: "Official Gemini agent with ACP protocol support.",
  packageSpec: "@google/gemini-code",
  defaultCommand: "gemini --acp --allowed-tools all,run_shell_command --experimental-skills",
  checkCommand: "gemini",
  defaultEnv: {},
};
