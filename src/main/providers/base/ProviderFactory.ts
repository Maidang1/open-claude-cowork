import type { ProviderMessageHandler } from "./AgentProvider";
import type { AgentProvider, AgentProviderType } from "./AgentProvider";
import { AcpProvider } from "../acp/AcpProvider";
import { ClaudeProvider } from "../claude/ClaudeProvider";

export const createProvider = (
  type: AgentProviderType,
  onMessage: ProviderMessageHandler,
): AgentProvider => {
  if (type === "claude-sdk") {
    return new ClaudeProvider(onMessage);
  }
  return new AcpProvider(onMessage);
};
