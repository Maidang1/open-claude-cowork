import type { IncomingMessage } from "@src/types/agentTypes";

export type AgentProviderType = "acp" | "claude-sdk";

export type AcpProviderPayload = {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
};

export type ClaudeSdkProviderPayload = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  cwd?: string;
  options?: Record<string, any>;
};

export type AgentProviderConfig =
  | { type: "acp"; payload: AcpProviderPayload }
  | { type: "claude-sdk"; payload: ClaudeSdkProviderPayload };

export interface AgentProvider {
  type: AgentProviderType;
  connect(
    config: AgentProviderConfig,
    options?: { reuseIfSame?: boolean; createSession?: boolean },
  ): Promise<{ sessionId?: string | null }>;
  disconnect(): Promise<void>;
  sendMessage(text: string, images?: Array<{ mimeType: string; dataUrl: string }>): Promise<void>;
  stopCurrentRequest(): Promise<void>;
  resolvePermission?(id: string, response: any): void;
  getCapabilities?(): any;
  setModel?(modelId: string): Promise<{ success: boolean; error?: string }>;
  createSession?(cwd?: string): Promise<string | null>;
  loadSession?(sessionId: string, cwd?: string): Promise<void>;
  resumeSession?(sessionId: string, cwd?: string): Promise<void>;
  setActiveSession?(sessionId: string, cwd?: string): void;
}

export type ProviderMessageHandler = (msg: IncomingMessage) => void;
