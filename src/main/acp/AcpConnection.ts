import { type ChildProcess, exec, spawn } from "node:child_process";
import fs from "node:fs/promises";
import { Readable, Writable } from "node:stream";
import { promisify } from "node:util";
import type { ContentBlock } from "@agentclientprotocol/sdk";
import { ClientSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";
import type { IncomingMessage } from "@src/types/acpTypes";
import { resolveWorkspacePath } from "./paths";

const execAsync = promisify(exec);

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const PROMPT_TIMEOUT_MS = 5 * 60_000;

export type PermissionRequestPayload = {
  tool?: string;
  options?: any[];
  content?: string;
  rawParams?: any;
};

export type AcpConnectionHandlers = {
  onSessionUpdate: (sessionId: string, update: any) => void;
  onPermissionRequest: (payload: PermissionRequestPayload) => Promise<any>;
  onSystemMessage?: (msg: IncomingMessage) => void;
  onToolLog?: (text: string) => void;
};

export class AcpConnection {
  private process: ChildProcess | null = null;
  private connection: ClientSideConnection | null = null;
  private cwd = process.cwd();
  private connected = false;
  private agentCapabilities: any | null = null;
  private handlers: AcpConnectionHandlers;

  private promptTimeout: NodeJS.Timeout | null = null;
  private promptTimeoutStartedAt: number | null = null;
  private promptTimeoutRemainingMs: number | null = null;
  private promptTimeoutReject: ((err: Error) => void) | null = null;

  constructor(handlers: AcpConnectionHandlers) {
    this.handlers = handlers;
  }

  setWorkspace(cwd: string) {
    this.cwd = cwd;
  }

  async connect(command: string, args: string[] = [], cwd?: string, env?: Record<string, string>) {
    if (this.process) {
      await this.disconnect();
    }

    this.cwd = cwd || process.cwd();

    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      cwd: this.cwd,
      env: env ? { ...process.env, ...env } : process.env,
    });

    if (this.process.stderr) {
      this.process.stderr.on("data", (data) => {
        const text = data.toString();
        this.handlers.onSystemMessage?.({
          type: "system",
          text: `System Error (stderr): ${text}`,
        });
      });
    }

    this.process.on("error", (err) => {
      this.handlers.onSystemMessage?.({
        type: "system",
        text: `System: Agent process error: ${err.message}`,
      });
      this.connected = false;
    });

    this.process.on("exit", (code) => {
      this.handlers.onSystemMessage?.({
        type: "system",
        text: `System: Agent disconnected (code ${code}). Check if '${command}' is installed and in your PATH.`,
      });
      this.process = null;
      this.connection = null;
      this.connected = false;
      this.agentCapabilities = null;
    });

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error("Failed to access process streams");
    }

    const input = Readable.toWeb(this.process.stdout) as any;
    const output = Writable.toWeb(this.process.stdin) as any;
    const stream = ndJsonStream(output, input);

    this.connection = new ClientSideConnection(
      (_agent) => ({
        requestPermission: async (params) => {
          this.pausePromptTimeout();
          try {
            return await this.handlers.onPermissionRequest({
              tool: params.toolCall?.title || "Unknown Tool",
              options: params.options,
              rawParams: params,
            });
          } finally {
            this.resumePromptTimeout();
          }
        },
        sessionUpdate: async (params) => {
          this.handlers.onSessionUpdate(params.sessionId, params.update);
        },
        readTextFile: async (params) => {
          const resolvedPath = resolveWorkspacePath(this.cwd, params.path);
          this.handlers.onToolLog?.(`Reading file: ${params.path}`);
          try {
            const content = await fs.readFile(resolvedPath, "utf-8");
            return { content };
          } catch (e: any) {
            throw new Error(`Failed to read file: ${e.message}`);
          }
        },
        writeTextFile: async (params) => {
          const resolvedPath = resolveWorkspacePath(this.cwd, params.path);
          this.handlers.onToolLog?.(`Writing file: ${params.path}`);
          try {
            await fs.writeFile(resolvedPath, params.content, "utf-8");
            return {};
          } catch (e: any) {
            throw new Error(`Failed to write file: ${e.message}`);
          }
        },
        extMethod: async (method, params: any) => {
          if (method === "runShellCommand") {
            return this.handleRunShellCommand(params);
          }
          return {};
        },
      }),
      stream,
    );
  }

  private async handleRunShellCommand(params: any) {
    const command = typeof params?.command === "string" ? params.command : "";
    if (!command) {
      throw new Error("Missing shell command");
    }

    this.pausePromptTimeout();
    let response: any;
    try {
      response = await this.handlers.onPermissionRequest({
        tool: "runShellCommand",
        content: `Request to run shell command:\n${command}`,
        options: [
          { optionId: "allow", label: "Allow" },
          { optionId: "deny", label: "Deny" },
        ],
      });
    } finally {
      this.resumePromptTimeout();
    }

    if (response?.outcome?.outcome === "selected" && response.outcome.optionId === "allow") {
      this.handlers.onToolLog?.(`Executing shell command: ${command}`);
      try {
        const { stdout, stderr } = await execAsync(command, { cwd: this.cwd });
        return { stdout, stderr, exitCode: 0 };
      } catch (e: any) {
        return { stdout: "", stderr: e.message, exitCode: e.code || 1 };
      }
    }

    throw new Error("User denied shell command execution");
  }

  async initialize() {
    if (!this.connection) {
      throw new Error("Connection closed before initialization");
    }
    const initResult = await this.withTimeout(
      this.connection.initialize({
        protocolVersion: 1,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
          // @ts-expect-error - protocol extension handled by agent
          runShellCommand: true,
        },
        clientInfo: { name: "open-claude-cowork", version: "1.0.0" },
      }),
      DEFAULT_REQUEST_TIMEOUT_MS,
      "initialize",
    );

    this.agentCapabilities = initResult?.agentCapabilities ?? null;
    this.connected = true;
    return initResult;
  }

  async newSession(cwd?: string, mcpServers?: any[]) {
    if (!this.connection) {
      throw new Error("Connection closed before session creation");
    }
    console.log("[AcpConnection] newSession called with:", {
      cwd: cwd || this.cwd,
      mcpServers: mcpServers || [],
      mcpServersCount: (mcpServers || []).length,
    });
    return this.withTimeout(
      this.connection.newSession({
        cwd: cwd || this.cwd,
        mcpServers: mcpServers || [],
      }),
      DEFAULT_REQUEST_TIMEOUT_MS,
      "session/new",
    );
  }

  async loadSession(sessionId: string, cwd?: string, mcpServers?: any[]) {
    if (!this.connection || !this.connection.loadSession) {
      throw new Error("Agent does not support session/load");
    }
    console.log("[AcpConnection] loadSession called with:", {
      sessionId,
      cwd: cwd || this.cwd,
      mcpServers: mcpServers || [],
      mcpServersCount: (mcpServers || []).length,
    });
    return this.withTimeout(
      this.connection.loadSession({
        sessionId,
        cwd: cwd || this.cwd,
        mcpServers: mcpServers || [],
      }),
      DEFAULT_REQUEST_TIMEOUT_MS,
      "session/load",
    );
  }

  async resumeSession(sessionId: string, cwd?: string, mcpServers?: any[]) {
    if (!this.connection || !this.connection.unstable_resumeSession) {
      throw new Error("Agent does not support session/resume");
    }
    console.log("[AcpConnection] resumeSession called with:", {
      sessionId,
      cwd: cwd || this.cwd,
      mcpServers: mcpServers || [],
      mcpServersCount: (mcpServers || []).length,
    });
    return this.withTimeout(
      this.connection.unstable_resumeSession({
        sessionId,
        cwd: cwd || this.cwd,
        mcpServers: mcpServers || [],
      }),
      DEFAULT_REQUEST_TIMEOUT_MS,
      "session/resume",
    );
  }

  async prompt(sessionId: string, prompt: ContentBlock[]) {
    if (!this.connection) {
      throw new Error("Connection closed before prompt");
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      this.promptTimeoutReject = reject;
      this.startPromptTimeout(PROMPT_TIMEOUT_MS);
    });

    try {
      return await Promise.race([this.connection.prompt({ sessionId, prompt }), timeoutPromise]);
    } finally {
      this.clearPromptTimeout();
    }
  }

  async cancel(sessionId: string) {
    if (!this.connection) {
      throw new Error("Connection closed before cancel");
    }
    await this.connection.cancel({ sessionId });
  }

  async setSessionModel(sessionId: string, modelId: string) {
    if (!this.connection || !this.connection.unstable_setSessionModel) {
      throw new Error("Agent does not support session/set_model");
    }
    return this.withTimeout(
      this.connection.unstable_setSessionModel({ sessionId, modelId }),
      DEFAULT_REQUEST_TIMEOUT_MS,
      "session/set_model",
    );
  }

  getCapabilities() {
    return this.agentCapabilities;
  }

  isConnected() {
    return this.connected && !!this.connection;
  }

  async disconnect() {
    const proc = this.process;
    if (proc) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finalize = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        proc.once("exit", finalize);
        proc.kill();
        setTimeout(finalize, 2000);
      });
      this.process = null;
    }
    this.connection = null;
    this.connected = false;
    this.agentCapabilities = null;
    this.clearPromptTimeout();
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private startPromptTimeout(durationMs: number) {
    this.clearPromptTimeout();
    this.promptTimeoutRemainingMs = durationMs;
    this.promptTimeoutStartedAt = Date.now();
    this.promptTimeout = setTimeout(() => {
      this.promptTimeout = null;
      this.promptTimeoutReject?.(new Error("Prompt timed out"));
    }, durationMs);
  }

  private pausePromptTimeout() {
    if (!this.promptTimeout || this.promptTimeoutStartedAt === null) {
      return;
    }
    clearTimeout(this.promptTimeout);
    this.promptTimeout = null;
    const elapsed = Date.now() - this.promptTimeoutStartedAt;
    this.promptTimeoutRemainingMs = Math.max(0, (this.promptTimeoutRemainingMs || 0) - elapsed);
    this.promptTimeoutStartedAt = null;
  }

  private resumePromptTimeout() {
    if (this.promptTimeout || this.promptTimeoutRemainingMs === null) {
      return;
    }
    this.promptTimeoutStartedAt = Date.now();
    this.promptTimeout = setTimeout(() => {
      this.promptTimeout = null;
      this.promptTimeoutReject?.(new Error("Prompt timed out"));
    }, this.promptTimeoutRemainingMs);
  }

  private clearPromptTimeout() {
    if (this.promptTimeout) {
      clearTimeout(this.promptTimeout);
      this.promptTimeout = null;
    }
    this.promptTimeoutStartedAt = null;
    this.promptTimeoutRemainingMs = null;
    this.promptTimeoutReject = null;
  }
}
