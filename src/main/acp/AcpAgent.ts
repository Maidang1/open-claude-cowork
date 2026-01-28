import fs from "node:fs/promises";
import type { ContentBlock } from "@agentclientprotocol/sdk";
import type { AgentInfoState, IncomingMessage } from "@src/types/acpTypes";
import { AcpAdapter, extractTokenUsage } from "./AcpAdapter";
import { AcpConnection } from "./AcpConnection";
import { resolveWorkspacePath } from "./paths";

const buildPromptContent = (
  text: string,
  images?: Array<{ mimeType: string; dataUrl: string }>,
) => {
  const prompt: ContentBlock[] = [{ type: "text", text }];

  if (images && images.length > 0) {
    for (const image of images) {
      const base64Data = image.dataUrl.replace(/^data:[^;]+;base64,/, "");
      prompt.push({
        type: "image",
        mimeType: image.mimeType,
        data: base64Data,
      });
    }
  }

  return prompt;
};

export class AcpAgent {
  private connection: AcpConnection | null = null;
  private adapter = new AcpAdapter();
  private onMessage: (msg: IncomingMessage) => void;
  private activeSessionId: string | null = null;
  private cwd = process.cwd();
  private agentCapabilities: any | null = null;
  private pendingPermissions = new Map<string, (response: any) => void>();

  constructor(onMessage: (msg: IncomingMessage) => void) {
    this.onMessage = onMessage;
  }

  async connect(
    command: string,
    args: string[] = [],
    cwd?: string,
    env?: Record<string, string>,
    options?: { createSession?: boolean },
  ) {
    if (this.connection) {
      await this.disconnect();
    }

    this.cwd = cwd || process.cwd();

    this.connection = new AcpConnection({
      onSessionUpdate: (sessionId, update) => {
        const message = this.adapter.convertSessionUpdate(sessionId, update);
        if (message) {
          this.onMessage(message);
        }
      },
      onPermissionRequest: async (payload) => {
        return this.handlePermissionRequest(payload);
      },
      onSystemMessage: (msg) => this.onMessage(msg),
      onToolLog: (text) => this.onMessage({ type: "tool_log", text }),
    });

    await this.connection.connect(command, args, this.cwd, env);

    try {
      const initResult = await this.connection.initialize();
      this.agentCapabilities = initResult?.agentCapabilities ?? null;

      if (options?.createSession !== false) {
        const sessionId = await this.createSession(this.cwd, true);
        return { sessionId };
      }

      this.onMessage({
        type: "system",
        text: "System: Connected.",
      });

      return { sessionId: null };
    } catch (e: any) {
      this.onMessage({
        type: "system",
        text: `System: Init failed: ${e.message}`,
      });
      await this.disconnect();
      throw e;
    }
  }

  async sendMessage(text: string, images?: Array<{ mimeType: string; dataUrl: string }>) {
    if (!this.connection || !this.activeSessionId) {
      throw new Error("Not connected");
    }

    const expandedText = await this.processAtFileReferences(text);
    const prompt = buildPromptContent(expandedText, images);

    try {
      const response = await this.connection.prompt(this.activeSessionId, prompt);
      const usage = extractTokenUsage(response);
      if (usage) {
        this.onMessage({
          type: "agent_info",
          sessionId: this.activeSessionId ?? undefined,
          info: { tokenUsage: usage },
        });
      }
      // 处理停止原因
      if (response?.stopReason) {
        console.log(`[AcpAgent] Prompt completed with stop reason: ${response.stopReason}`);
        // 如果是 cancelled，可能需要额外处理
        if (response.stopReason === "cancelled") {
          this.onMessage({
            type: "system",
            sessionId: this.activeSessionId ?? undefined,
            text: "System: Prompt cancelled by user.",
          });
        }
      }
      // 发送回复结束消息
      this.onMessage({
        type: "response_end",
        sessionId: this.activeSessionId ?? undefined,
        stopReason: response?.stopReason,
      });
    } catch (err: any) {
      if (err?.message?.includes("timed out")) {
        this.onMessage({
          type: "system",
          text: `System Error: ${err.message}`,
        });
        return;
      }

      this.onMessage({
        type: "system",
        text: `System Error: ${err.message}`,
      });
    }
  }

  async stopCurrentRequest() {
    if (!this.connection || !this.activeSessionId) {
      return;
    }
    try {
      await this.connection.cancel(this.activeSessionId);
    } catch (err: any) {
      this.onMessage({
        type: "system",
        text: `System Error: ${err.message}`,
      });
    }
  }

  async createSession(cwd?: string, isInitial = false, mcpServers?: any[]) {
    if (!this.connection) {
      throw new Error("Connection closed before session creation");
    }
    const nextCwd = cwd || this.cwd;
    this.cwd = nextCwd;
    this.connection.setWorkspace(nextCwd);
    const sessionResult = await this.connection.newSession(nextCwd, mcpServers);
    this.activeSessionId = sessionResult.sessionId;
    this.onMessage({
      type: "system",
      text: isInitial ? "System: Connected and Session Created." : "System: Session Created.",
    });
    this.handleSessionInitUpdate(sessionResult);
    return sessionResult.sessionId;
  }

  async loadSession(sessionId: string, cwd?: string, mcpServers?: any[]) {
    if (!this.connection) {
      throw new Error("Connection closed before session load");
    }
    const nextCwd = cwd || this.cwd;
    this.cwd = nextCwd;
    this.connection.setWorkspace(nextCwd);
    const result = await this.connection.loadSession(sessionId, nextCwd, mcpServers);
    this.activeSessionId = sessionId;
    this.onMessage({
      type: "system",
      text: "System: Session Loaded.",
    });
    this.handleSessionInitUpdate(result);
  }

  async resumeSession(sessionId: string, cwd?: string, mcpServers?: any[]) {
    if (!this.connection) {
      throw new Error("Connection closed before session resume");
    }
    const nextCwd = cwd || this.cwd;
    this.cwd = nextCwd;
    this.connection.setWorkspace(nextCwd);
    const result = await this.connection.resumeSession(sessionId, nextCwd, mcpServers);
    this.activeSessionId = sessionId;
    this.onMessage({
      type: "system",
      text: "System: Session Resumed.",
    });
    this.handleSessionInitUpdate(result);
  }

  setActiveSession(sessionId: string, cwd?: string) {
    this.activeSessionId = sessionId;
    if (cwd && this.connection) {
      this.cwd = cwd;
      this.connection.setWorkspace(cwd);
    }
  }

  isConnected() {
    return this.connection?.isConnected() ?? false;
  }

  getCapabilities() {
    return this.agentCapabilities;
  }

  resolvePermission(id: string, response: any) {
    const resolver = this.pendingPermissions.get(id);
    if (resolver) {
      resolver(response);
      this.pendingPermissions.delete(id);
    } else {
      this.onMessage({
        type: "system",
        text: `System: No pending permission found for id: ${id}`,
      });
    }
  }

  async setModel(modelId: string) {
    if (!this.connection || !this.activeSessionId) {
      throw new Error("Not connected");
    }

    try {
      await this.connection.setSessionModel(this.activeSessionId, modelId);
      this.onMessage({
        type: "agent_info",
        sessionId: this.activeSessionId ?? undefined,
        info: { currentModelId: modelId },
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.disconnect();
    }
    this.connection = null;
    this.activeSessionId = null;
    this.agentCapabilities = null;
    this.pendingPermissions.clear();
  }

  private handleSessionInitUpdate(sessionResult: any) {
    if (sessionResult?.models?.availableModels?.length) {
      this.onMessage({
        type: "agent_info",
        sessionId: this.activeSessionId ?? undefined,
        info: {
          models: sessionResult.models.availableModels,
          currentModelId: sessionResult.models.currentModelId,
        } as Partial<AgentInfoState>,
      });
      return;
    }

    if (sessionResult?.configOptions?.length) {
      const modelUpdate = sessionResult.configOptions.find(
        (option: any) => option?.category === "model" && option?.type === "select",
      );
      if (modelUpdate) {
        const models = (modelUpdate.options || [])
          .flatMap((entry: any) => (entry?.options ? entry.options : [entry]))
          .filter((entry: any) => entry?.value && entry?.name)
          .map((entry: any) => ({
            modelId: entry.value,
            name: entry.name,
            description: entry.description ?? null,
          }));
        if (models.length > 0) {
          this.onMessage({
            type: "agent_info",
            sessionId: this.activeSessionId ?? undefined,
            info: {
              models,
              currentModelId: modelUpdate.currentValue ?? null,
            },
          });
        }
      }
    }
  }

  private async handlePermissionRequest(payload: {
    tool?: string;
    options?: any[];
    content?: string;
    rawParams?: any;
  }) {
    const permissionId = Math.random().toString(36).substring(7);
    const toolName = payload.tool || payload.rawParams?.toolCall?.title || "Unknown Tool";
    const options = payload.options ?? payload.rawParams?.options;
    this.onMessage({
      type: "permission_request",
      id: permissionId,
      tool: toolName,
      text: payload.content,
      options,
      sessionId: this.activeSessionId ?? undefined,
    });

    return new Promise((resolve) => {
      this.pendingPermissions.set(permissionId, resolve);
    });
  }

  private async processAtFileReferences(text: string) {
    const matches = Array.from(text.matchAll(/@file\s*\(?([^\s)]+)\)?/g));
    if (matches.length === 0) {
      return text;
    }

    const snippets: string[] = [];
    for (const match of matches) {
      const filePath = match[1];
      if (!filePath) continue;
      try {
        const resolved = resolveWorkspacePath(this.cwd, filePath);
        const content = await fs.readFile(resolved, "utf-8");
        snippets.push(`\n\n[File: ${filePath}]\n${content}`);
      } catch (e: any) {
        snippets.push(`\n\n[File: ${filePath}]\n<Failed to read file: ${e.message}>`);
      }
    }

    return `${text}${snippets.join("")}`;
  }
}
