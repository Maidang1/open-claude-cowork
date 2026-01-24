import type { AgentPlugin } from "./types";

export const QwenAgent: AgentPlugin = {
  id: "qwen",
  name: "Qwen Agent",
  description: "Official Qwen agent with ACP protocol support.",
  packageSpec: "@qwen-code/qwen-code",
  defaultCommand: "qwen --acp --allowed-tools all,run_shell_command --experimental-skills",
  checkCommand: "qwen",
  defaultEnv: {},
};
