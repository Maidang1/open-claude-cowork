import type { IncomingMessage } from "@src/types/agentTypes";
import type { AgentProvider, AgentProviderConfig, AgentProviderType } from "./AgentProvider";
import { createProvider } from "./ProviderFactory";

export class ProviderManager {
  private providers = new Map<string, AgentProvider>();
  private providerMeta = new Map<string, { type: AgentProviderType; sessionId?: string | null }>();
  private onMessage: (msg: IncomingMessage, taskId: string) => void;

  constructor(onMessage: (msg: IncomingMessage, taskId: string) => void) {
    this.onMessage = onMessage;
  }

  get(taskId: string): AgentProvider | null {
    return this.providers.get(taskId) ?? null;
  }

  async connect(
    taskId: string,
    config: AgentProviderConfig,
    options?: { reuseIfSame?: boolean; createSession?: boolean },
  ) {
    const existing = this.providers.get(taskId);
    if (existing && existing.type !== config.type) {
      await existing.disconnect();
      this.providers.delete(taskId);
    }
    const provider =
      this.providers.get(taskId) ?? createProvider(config.type, (msg) => this.onMessage(msg, taskId));
    if (!this.providers.has(taskId)) {
      this.providers.set(taskId, provider);
    }
    const result = await provider.connect(config, options);
    this.providerMeta.set(taskId, { type: provider.type, sessionId: result?.sessionId ?? null });
    return { success: true, ...result };
  }

  async disconnect(taskId: string) {
    const provider = this.providers.get(taskId);
    if (provider) {
      await provider.disconnect();
      this.providers.delete(taskId);
      this.providerMeta.delete(taskId);
    }
    return { success: true };
  }

  async sendMessage(taskId: string, text: string, images?: Array<{ mimeType: string; dataUrl: string }>) {
    const provider = this.requireProvider(taskId);
    await provider.sendMessage(text, images);
  }

  async stopCurrentRequest(taskId: string) {
    const provider = this.requireProvider(taskId);
    await provider.stopCurrentRequest();
    return { success: true };
  }

  resolvePermission(taskId: string, id: string, response: any) {
    const provider = this.requireProvider(taskId);
    if (provider.resolvePermission) {
      provider.resolvePermission(id, response);
      return;
    }
    throw new Error("Provider does not support permission responses");
  }

  getCapabilities(taskId: string) {
    const provider = this.requireProvider(taskId);
    return provider.getCapabilities?.() ?? null;
  }

  async createSession(taskId: string, cwd?: string) {
    const provider = this.requireProvider(taskId);
    if (!provider.createSession) {
      throw new Error("Provider does not support session creation");
    }
    const sessionId = await provider.createSession(cwd);
    this.setSessionId(taskId, sessionId ?? null);
    return { success: true, sessionId: sessionId ?? null };
  }

  async loadSession(taskId: string, sessionId: string, cwd?: string) {
    const provider = this.requireProvider(taskId);
    if (!provider.loadSession) {
      throw new Error("Provider does not support session load");
    }
    await provider.loadSession(sessionId, cwd);
    this.setSessionId(taskId, sessionId);
    return { success: true };
  }

  async resumeSession(taskId: string, sessionId: string, cwd?: string) {
    const provider = this.requireProvider(taskId);
    if (!provider.resumeSession) {
      throw new Error("Provider does not support session resume");
    }
    await provider.resumeSession(sessionId, cwd);
    this.setSessionId(taskId, sessionId);
    return { success: true };
  }

  async setActiveSession(taskId: string, sessionId: string, cwd?: string) {
    const provider = this.requireProvider(taskId);
    if (!provider.setActiveSession) {
      throw new Error("Provider does not support setActiveSession");
    }
    provider.setActiveSession(sessionId, cwd);
    this.setSessionId(taskId, sessionId);
    return { success: true };
  }

  async setModel(taskId: string, modelId: string) {
    const provider = this.requireProvider(taskId);
    if (!provider.setModel) {
      throw new Error("Provider does not support setModel");
    }
    return await provider.setModel(modelId);
  }

  private setSessionId(taskId: string, sessionId: string | null) {
    const meta = this.providerMeta.get(taskId);
    if (meta) {
      this.providerMeta.set(taskId, { ...meta, sessionId });
    }
  }

  private requireProvider(taskId: string) {
    const provider = this.providers.get(taskId);
    if (!provider) {
      throw new Error("Agent not connected");
    }
    return provider;
  }
}
