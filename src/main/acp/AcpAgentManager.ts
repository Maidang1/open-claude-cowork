import type { IncomingMessage } from "@src/types/acpTypes";
import {
  enrichPathFromLoginShell,
  getCustomNodePath,
  resolveActualJsEntry,
  resolveNodeRuntime,
} from "../utils/node-runtime";
import { getLocalAgentBin, parseCommandLine, shellQuote } from "../utils/shell";
import { AcpAgent } from "./AcpAgent";
import { acpDetector } from "./AcpDetector";

export class AcpAgentManager {
  private agents = new Map<string, AcpAgent>();
  private activeConnectionKey: string | null = null;
  private sessionToConnectionKey = new Map<string, string>();
  private onMessage: (msg: IncomingMessage) => void;

  constructor(onMessage: (msg: IncomingMessage) => void) {
    this.onMessage = onMessage;
  }

  private get activeAgent(): AcpAgent | null {
    if (!this.activeConnectionKey) return null;
    return this.agents.get(this.activeConnectionKey) || null;
  }

  private sortEnv(env?: Record<string, string>): Record<string, string> | undefined {
    if (!env) return undefined;
    return Object.keys(env)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = env[key];
          return acc;
        },
        {} as Record<string, string>,
      );
  }

  async connect(
    command: string,
    cwd?: string,
    env?: Record<string, string>,
    options?: { reuseIfSame?: boolean; createSession?: boolean },
  ) {
    const { cmd, args, resolvedEnv } = await this.resolveCommand(command, env);
    const stableEnv = this.sortEnv(resolvedEnv);

    const connectionKey = JSON.stringify({
      cmd,
      args,
      env: stableEnv || null,
    });

    const reuseIfSame = options?.reuseIfSame ?? true;

    if (this.agents.has(connectionKey)) {
      if (reuseIfSame) {
        const agent = this.agents.get(connectionKey)!;
        if (agent.isConnected()) {
          this.activeConnectionKey = connectionKey;
          return { success: true, reused: true, sessionId: null };
        }
      }
    }

    let agent = this.agents.get(connectionKey);
    if (!agent) {
      agent = new AcpAgent(this.onMessage);
      this.agents.set(connectionKey, agent);
    }

    this.activeConnectionKey = connectionKey;

    const result = await agent.connect(cmd, args, cwd, stableEnv, {
      createSession: options?.createSession ?? true,
    });

    if (result.sessionId) {
      this.sessionToConnectionKey.set(result.sessionId, connectionKey);
    }

    return {
      success: true,
      reused: false,
      sessionId: result?.sessionId ?? null,
    };
  }

  async disconnect() {
    const promises = Array.from(this.agents.values()).map((agent) => agent.disconnect());
    await Promise.all(promises);
    this.agents.clear();
    this.activeConnectionKey = null;
    this.sessionToConnectionKey.clear();
    return { success: true };
  }

  isConnected() {
    return this.activeAgent?.isConnected() ?? false;
  }

  getCapabilities() {
    return this.activeAgent?.getCapabilities() ?? null;
  }

  async sendMessage(message: string, images?: Array<{ mimeType: string; dataUrl: string }>) {
    if (!this.activeAgent) {
      throw new Error("Agent not connected");
    }
    await this.activeAgent.sendMessage(message, images);
  }

  resolvePermission(id: string, response: any) {
    for (const agent of this.agents.values()) {
      if (agent.resolvePermission(id, response)) {
        return;
      }
    }
    this.onMessage({
      type: "system",
      text: `System: No pending permission found for id: ${id}`,
    });
  }

  async createSession(cwd?: string) {
    if (!this.activeAgent) {
      throw new Error("Agent not connected");
    }
    const sessionId = await this.activeAgent.createSession(cwd);
    if (this.activeConnectionKey) {
      this.sessionToConnectionKey.set(sessionId, this.activeConnectionKey);
    }
    return { success: true, sessionId };
  }

  async loadSession(sessionId: string, cwd?: string) {
    const key = this.sessionToConnectionKey.get(sessionId);
    if (key && this.agents.has(key)) {
      this.activeConnectionKey = key;
    }

    if (!this.activeAgent) {
      throw new Error("Agent not connected");
    }
    await this.activeAgent.loadSession(sessionId, cwd);
    if (this.activeConnectionKey) {
      this.sessionToConnectionKey.set(sessionId, this.activeConnectionKey);
    }
    return { success: true };
  }

  async resumeSession(sessionId: string, cwd?: string) {
    const key = this.sessionToConnectionKey.get(sessionId);
    if (key && this.agents.has(key)) {
      this.activeConnectionKey = key;
    }

    if (!this.activeAgent) {
      throw new Error("Agent not connected");
    }
    await this.activeAgent.resumeSession(sessionId, cwd);
    if (this.activeConnectionKey) {
      this.sessionToConnectionKey.set(sessionId, this.activeConnectionKey);
    }
    return { success: true };
  }

  async setActiveSession(sessionId: string, cwd?: string) {
    const key = this.sessionToConnectionKey.get(sessionId);
    if (key && this.agents.has(key)) {
      this.activeConnectionKey = key;
    }

    if (!this.activeAgent) {
      throw new Error("Agent not connected");
    }
    this.activeAgent.setActiveSession(sessionId, cwd);
    return { success: true };
  }

  async setModel(modelId: string) {
    if (!this.activeAgent) {
      throw new Error("Agent not connected");
    }
    return await this.activeAgent.setModel(modelId);
  }

  async stopCurrentRequest() {
    if (!this.activeAgent) {
      throw new Error("Agent not connected");
    }
    await this.activeAgent.stopCurrentRequest();
    return { success: true };
  }

  async getAvailableAgents() {
    return await acpDetector.getAvailableAgents();
  }

  async detectCliPath(command: string) {
    return await acpDetector.detectCliPath(command);
  }

  private async resolveCommand(command: string, env?: Record<string, string>) {
    await enrichPathFromLoginShell();
    getCustomNodePath();

    const parts = parseCommandLine(command.trim());
    if (parts.length === 0) {
      throw new Error("Agent command is empty.");
    }

    let cmd = parts[0];
    const args = parts.slice(1);
    let resolvedEnv = env;

    const localBin = getLocalAgentBin(cmd);
    if (localBin) {
      if (process.platform !== "win32") {
        try {
          const fs = await import("node:fs/promises");
          await fs.chmod(localBin, 0o755);
        } catch (e) {
          console.warn(`[Main] Failed to chmod local bin: ${e}`);
        }
      }

      const actualEntry = await resolveActualJsEntry(localBin);
      const shouldUseNode = actualEntry?.isNodeScript ?? false;

      if (shouldUseNode) {
        const jsPath = actualEntry?.path || localBin;
        args.unshift(shellQuote(jsPath));

        const nodeRuntime = await resolveNodeRuntime();
        cmd = shellQuote(nodeRuntime.file);
        if (nodeRuntime.env) {
          resolvedEnv = { ...(resolvedEnv || {}), ...nodeRuntime.env };
        }
      } else {
        cmd = shellQuote(localBin);
      }
    }

    return { cmd, args, resolvedEnv };
  }
}
