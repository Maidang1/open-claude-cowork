import type { IncomingMessage } from "@src/types/agentTypes";
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
  private agent: AcpAgent | null = null;
  private activeConnectionKey: string | null = null;
  private onMessage: (msg: IncomingMessage) => void;

  constructor(onMessage: (msg: IncomingMessage) => void) {
    this.onMessage = onMessage;
  }

  async connect(
    command: string,
    cwd?: string,
    env?: Record<string, string>,
    options?: { reuseIfSame?: boolean; createSession?: boolean },
  ) {
    if (!this.agent) {
      this.agent = new AcpAgent(this.onMessage);
    }

    const { cmd, args, resolvedEnv } = await this.resolveCommand(command, env);

    const connectionKey = JSON.stringify({
      cmd,
      args,
      env: resolvedEnv || null,
    });

    if (
      options?.reuseIfSame &&
      this.agent.isConnected() &&
      this.activeConnectionKey === connectionKey
    ) {
      return { success: true, reused: true, sessionId: null };
    }

    const result = await this.agent.connect(cmd, args, cwd, resolvedEnv, {
      createSession: options?.createSession ?? true,
    });
    this.activeConnectionKey = connectionKey;
    return {
      success: true,
      reused: false,
      sessionId: result?.sessionId ?? null,
    };
  }

  async disconnect() {
    if (this.agent) {
      await this.agent.disconnect();
      this.agent = null;
      this.activeConnectionKey = null;
    }
    return { success: true };
  }

  isConnected() {
    return this.agent?.isConnected() ?? false;
  }

  getCapabilities() {
    return this.agent?.getCapabilities() ?? null;
  }

  async sendMessage(message: string, images?: Array<{ mimeType: string; dataUrl: string }>) {
    if (!this.agent) {
      throw new Error("Agent not connected");
    }
    await this.agent.sendMessage(message, images);
  }

  resolvePermission(id: string, response: any) {
    this.agent?.resolvePermission(id, response);
  }

  async createSession(cwd?: string) {
    if (!this.agent) {
      throw new Error("Agent not connected");
    }
    const sessionId = await this.agent.createSession(cwd);
    return { success: true, sessionId };
  }

  async loadSession(sessionId: string, cwd?: string) {
    if (!this.agent) {
      throw new Error("Agent not connected");
    }
    await this.agent.loadSession(sessionId, cwd);
    return { success: true };
  }

  async resumeSession(sessionId: string, cwd?: string) {
    if (!this.agent) {
      throw new Error("Agent not connected");
    }
    await this.agent.resumeSession(sessionId, cwd);
    return { success: true };
  }

  async setActiveSession(sessionId: string, cwd?: string) {
    if (!this.agent) {
      throw new Error("Agent not connected");
    }
    this.agent.setActiveSession(sessionId, cwd);
    return { success: true };
  }

  async setModel(modelId: string) {
    if (!this.agent) {
      throw new Error("Agent not connected");
    }
    return await this.agent.setModel(modelId);
  }

  async stopCurrentRequest() {
    if (!this.agent) {
      throw new Error("Agent not connected");
    }
    await this.agent.stopCurrentRequest();
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
