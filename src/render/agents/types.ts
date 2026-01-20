export interface AgentPlugin {
  id: string;
  name: string;
  description: string;
  packageSpec?: string; // npm package name (e.g., "@qwen-code/qwen-code")
  defaultCommand: string; // Launch command
  defaultEnv?: Record<string, string>;
  checkCommand?: string; // Command to check binary existence
}
