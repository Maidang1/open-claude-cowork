import type { AgentProvider, AgentProviderConfig, ProviderMessageHandler } from "../base/AgentProvider";
import { AcpAgentManager } from "../../acp/AcpAgentManager";

export class AcpProvider implements AgentProvider {
  type: AgentProvider["type"] = "acp";
  private manager: AcpAgentManager;

  constructor(onMessage: ProviderMessageHandler) {
    this.manager = new AcpAgentManager(onMessage);
  }

  async connect(
    config: AgentProviderConfig,
    options?: { reuseIfSame?: boolean; createSession?: boolean },
  ) {
    if (config.type !== "acp") {
      throw new Error("Invalid config type for AcpProvider");
    }
    const { command, cwd, env } = config.payload;
    return await this.manager.connect(command, cwd, env, options);
  }

  async disconnect() {
    await this.manager.disconnect();
  }

  async sendMessage(text: string, images?: Array<{ mimeType: string; dataUrl: string }>) {
    await this.manager.sendMessage(text, images);
  }

  resolvePermission(id: string, response: any) {
    this.manager.resolvePermission(id, response);
  }

  async createSession(cwd?: string) {
    const result = await this.manager.createSession(cwd);
    return result.sessionId ?? null;
  }

  async loadSession(sessionId: string, cwd?: string) {
    await this.manager.loadSession(sessionId, cwd);
  }

  async resumeSession(sessionId: string, cwd?: string) {
    await this.manager.resumeSession(sessionId, cwd);
  }

  setActiveSession(sessionId: string, cwd?: string) {
    this.manager.setActiveSession(sessionId, cwd);
  }

  async setModel(modelId: string) {
    return await this.manager.setModel(modelId);
  }

  async stopCurrentRequest() {
    await this.manager.stopCurrentRequest();
  }

  getCapabilities() {
    return this.manager.getCapabilities();
  }
}
