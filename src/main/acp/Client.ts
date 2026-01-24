import { type ChildProcess, exec, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { promisify } from "node:util";
import { ClientSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";

const execAsync = promisify(exec);

type AgentModelInfo = {
  modelId: string;
  name: string;
  description?: string | null;
};

type AgentCommandInfo = {
  name: string;
  description?: string | null;
};

type AgentTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

const normalizeModelsFromConfigOptions = (configOptions: any[]) => {
  if (!Array.isArray(configOptions)) return null;

  for (const option of configOptions) {
    if (option?.category !== "model" || option?.type !== "select") {
      continue;
    }

    const groupsOrOptions = option?.options;
    if (!Array.isArray(groupsOrOptions)) {
      continue;
    }

    const models: AgentModelInfo[] = [];
    for (const entry of groupsOrOptions) {
      if (Array.isArray(entry?.options)) {
        for (const opt of entry.options) {
          if (opt?.value && opt?.name) {
            models.push({
              modelId: opt.value,
              name: opt.name,
              description: opt.description ?? null,
            });
          }
        }
      } else if (entry?.value && entry?.name) {
        models.push({
          modelId: entry.value,
          name: entry.name,
          description: entry.description ?? null,
        });
      }
    }

    if (models.length > 0) {
      return { models, currentModelId: option.currentValue ?? null };
    }
  }

  return null;
};

const extractTokenUsage = (payload: any): AgentTokenUsage | null => {
  const candidates = [
    payload,
    payload?.usage,
    payload?.tokenUsage,
    payload?.tokens,
    payload?._meta?.usage,
    payload?._meta?.tokenUsage,
    payload?._meta?.tokens,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const promptTokens =
      candidate.promptTokens ?? candidate.prompt_tokens ?? candidate.input_tokens;
    const completionTokens =
      candidate.completionTokens ?? candidate.completion_tokens ?? candidate.output_tokens;
    const totalTokens = candidate.totalTokens ?? candidate.total_tokens ?? candidate.total;

    if (
      typeof promptTokens === "number" ||
      typeof completionTokens === "number" ||
      typeof totalTokens === "number"
    ) {
      return {
        promptTokens: typeof promptTokens === "number" ? promptTokens : undefined,
        completionTokens: typeof completionTokens === "number" ? completionTokens : undefined,
        totalTokens: typeof totalTokens === "number" ? totalTokens : undefined,
      };
    }
  }

  return null;
};

export class ACPClient {
  private process: ChildProcess | null = null;
  private connection: ClientSideConnection | null = null;
  // Callback now sends structured objects instead of strings
  private onMessageCallback: ((msg: any) => void) | null = null;
  private activeSessionId: string | null = null;
  private cwd: string = process.cwd();
  private connected = false;
  private agentCapabilities: any | null = null;

  private pendingPermissions = new Map<string, (response: any) => void>();

  constructor(onMessage: (msg: any) => void) {
    this.onMessageCallback = onMessage;
  }

  resolvePermission(id: string, response: any) {
    const resolver = this.pendingPermissions.get(id);
    if (resolver) {
      resolver(response);
      this.pendingPermissions.delete(id);
    } else {
      console.warn(`[Client] No pending permission found for id: ${id}`);
    }
  }

  async connect(
    command: string,
    args: string[] = [],
    cwd?: string,
    env?: Record<string, string>,
    options?: { createSession?: boolean },
  ) {
    if (this.process) {
      await this.disconnect();
    }

    this.cwd = cwd || process.cwd();

    console.log(`[Client] Spawning agent: ${command} ${args.join(" ")} in ${this.cwd}`);
    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      cwd: this.cwd,
      env: env ? { ...process.env, ...env } : process.env,
    });

    // Capture stderr
    if (this.process.stderr) {
      this.process.stderr.on("data", (data) => {
        const text = data.toString();
        console.error(`[Client] stderr: ${text}`);
        this.onMessageCallback?.({
          type: "system",
          text: `System Error (stderr): ${text}`,
        });
      });
    }

    this.process.on("error", (err) => {
      console.error("[Client] Process error:", err);
      this.onMessageCallback?.({
        type: "system",
        text: `System: Agent process error: ${err.message}`,
      });
      this.connected = false;
    });

    this.process.on("exit", (code) => {
      console.log(`[Client] Agent exited with code ${code}`);
      this.onMessageCallback?.({
        type: "system",
        text: `System: Agent disconnected (code ${code}). Check if '${command}' is installed and in your PATH.`,
      });
      this.process = null;
      this.connection = null;
      this.activeSessionId = null;
      this.connected = false;
      this.agentCapabilities = null;
    });

    // Create Stream (Node -> Web Stream adapter)
    if (!this.process.stdout || !this.process.stdin) {
      throw new Error("Failed to access process streams");
    }

    const input = Readable.toWeb(this.process.stdout) as any;
    const output = Writable.toWeb(this.process.stdin) as any;
    const stream = ndJsonStream(output, input);

    // Create Connection
    this.connection = new ClientSideConnection(
      (_agent) => ({
        requestPermission: async (params) => {
          const options = params.options;
          const permissionId = Math.random().toString(36).substring(7);

          // Notify UI about permission request and wait for response
          this.onMessageCallback?.({
            type: "permission_request",
            id: permissionId,
            tool: params.toolCall?.title || "Unknown Tool",
            options: options,
          });

          // Return a promise that resolves when UI responds
          return new Promise((resolve) => {
            this.pendingPermissions.set(permissionId, resolve);
          });
        },
        sessionUpdate: async (params) => {
          const update = params.update;
          const sessionId = params.sessionId;

          // Agent Text Message
          if (update.sessionUpdate === "agent_message_chunk") {
            if (update.content.type === "text") {
              this.onMessageCallback?.({
                type: "agent_text",
                sessionId,
                text: update.content.text,
              });
            }
          }
          // Agent Thought
          else if (update.sessionUpdate === "agent_thought_chunk") {
            if (update.content.type === "text") {
              this.onMessageCallback?.({
                type: "agent_thought",
                sessionId,
                text: update.content.text,
              });
            }
          }
          // Tool Call
          else if (update.sessionUpdate === "tool_call") {
            this.onMessageCallback?.({
              type: "tool_call",
              sessionId,
              toolCallId: update.toolCallId,
              name: update.title,
              kind: update.kind,
              status: update.status,
            });
          }
          // Tool Call Update
          else if (update.sessionUpdate === "tool_call_update") {
            this.onMessageCallback?.({
              type: "tool_call_update",
              sessionId,
              toolCallId: update.toolCallId,
              status: update.status,
            });
          }
          // Available Commands Update
          else if (update.sessionUpdate === "available_commands_update") {
            this.onMessageCallback?.({
              type: "agent_info",
              sessionId,
              info: {
                commands: update.availableCommands as AgentCommandInfo[],
              },
            });
          }
          // Config Options Update (e.g., models)
          else if (update.sessionUpdate === "config_option_update") {
            const modelUpdate = normalizeModelsFromConfigOptions(update.configOptions);
            if (modelUpdate) {
              this.onMessageCallback?.({
                type: "agent_info",
                sessionId,
                info: modelUpdate,
              });
            }
          }
          // Plan Update
          else if (update.sessionUpdate === "plan") {
            this.onMessageCallback?.({
              type: "agent_plan",
              sessionId,
              plan: update,
            });
          }
        },
        readTextFile: async (params) => {
          console.log(`[Client] readTextFile: ${params.path}`);
          this.onMessageCallback?.({
            type: "tool_log",
            text: `Reading file: ${params.path}`,
          });
          try {
            const content = await fs.readFile(path.resolve(this.cwd, params.path), "utf-8");
            return { content };
          } catch (e: any) {
            throw new Error(`Failed to read file: ${e.message}`);
          }
        },
        writeTextFile: async (params) => {
          console.log(`[Client] writeTextFile: ${params.path}`);
          this.onMessageCallback?.({
            type: "tool_log",
            text: `Writing file: ${params.path}`,
          });
          try {
            await fs.writeFile(path.resolve(this.cwd, params.path), params.content, "utf-8");
            return {};
          } catch (e: any) {
            throw new Error(`Failed to write file: ${e.message}`);
          }
        },
        extMethod: async (method, params: any) => {
          console.log(`[Client] ExtMethod call: ${method}`, params);
          if (method === "runShellCommand") {
            const command = params.command;
            // Reuse the permission request flow
            const permissionId = Math.random().toString(36).substring(7);

            this.onMessageCallback?.({
              type: "permission_request",
              id: permissionId,
              tool: "runShellCommand",
              content: `Request to run shell command:\n${command}`,
              options: [
                { optionId: "allow", label: "Allow" },
                { optionId: "deny", label: "Deny" }, // Handled by null check in UI
              ],
            });

            const response: any = await new Promise((resolve) => {
              this.pendingPermissions.set(permissionId, resolve);
            });

            if (
              response?.outcome?.outcome === "selected" &&
              response.outcome.optionId === "allow"
            ) {
              this.onMessageCallback?.({
                type: "tool_log",
                text: `Executing shell command: ${command}`,
              });
              try {
                const { stdout, stderr } = await execAsync(command, {
                  cwd: this.cwd,
                });
                return { stdout, stderr, exitCode: 0 };
              } catch (e: any) {
                return { stdout: "", stderr: e.message, exitCode: e.code || 1 };
              }
            } else {
              throw new Error("User denied shell command execution");
            }
          }
          return {};
        },
      }),
      stream,
    );

    // Initialize Protocol
    try {
      if (!this.connection) {
        throw new Error("Connection closed before initialization");
      }
      const initResult = await this.connection.initialize({
        protocolVersion: 1,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
          // @ts-expect-error - Assuming protocol extension allows this or custom handling
          runShellCommand: true,
        },
        clientInfo: { name: "test-client", version: "1.0.0" },
      });
      console.log("Initialized:", initResult);
      this.agentCapabilities = initResult?.agentCapabilities ?? null;

      this.connected = true;
      if (options?.createSession !== false) {
        const sessionId = await this.createSession(this.cwd, true);
        return { sessionId };
      } else {
        this.onMessageCallback?.({
          type: "system",
          text: "System: Connected.",
        });
        return { sessionId: null };
      }
    } catch (e: any) {
      console.error("Init failed:", e);
      this.onMessageCallback?.({
        type: "system",
        text: `System: Init failed: ${e.message}`,
      });
      await this.disconnect();
      throw e;
    }
  }

  private handleSessionInitUpdate(sessionResult: any) {
    if (sessionResult?.models?.availableModels?.length) {
      this.onMessageCallback?.({
        type: "agent_info",
        info: {
          models: sessionResult.models.availableModels,
          currentModelId: sessionResult.models.currentModelId,
        },
      });
    } else if (sessionResult?.configOptions?.length) {
      const modelUpdate = normalizeModelsFromConfigOptions(sessionResult.configOptions);
      if (modelUpdate) {
        this.onMessageCallback?.({ type: "agent_info", info: modelUpdate });
      }
    }
  }

  async createSession(cwd?: string, isInitial = false) {
    if (!this.connection) {
      throw new Error("Connection closed before session creation");
    }
    const sessionResult = await this.connection.newSession({
      cwd: cwd || this.cwd,
      mcpServers: [],
    });
    this.activeSessionId = sessionResult.sessionId;
    this.onMessageCallback?.({
      type: "system",
      text: isInitial ? "System: Connected and Session Created." : "System: Session Created.",
    });
    this.handleSessionInitUpdate(sessionResult);
    return sessionResult.sessionId;
  }

  async loadSession(sessionId: string, cwd?: string) {
    if (!this.connection || !this.connection.loadSession) {
      throw new Error("Agent does not support session/load");
    }
    const result = await this.connection.loadSession({
      sessionId,
      cwd: cwd || this.cwd,
      mcpServers: [],
    });
    this.activeSessionId = sessionId;
    this.onMessageCallback?.({
      type: "system",
      text: "System: Session Loaded.",
    });
    this.handleSessionInitUpdate(result);
  }

  async resumeSession(sessionId: string, cwd?: string) {
    if (!this.connection || !this.connection.unstable_resumeSession) {
      throw new Error("Agent does not support session/resume");
    }
    const result = await this.connection.unstable_resumeSession({
      sessionId,
      cwd: cwd || this.cwd,
      mcpServers: [],
    });
    this.activeSessionId = sessionId;
    this.onMessageCallback?.({
      type: "system",
      text: "System: Session Resumed.",
    });
    this.handleSessionInitUpdate(result);
  }

  setActiveSession(sessionId: string) {
    this.activeSessionId = sessionId;
  }

  isConnected() {
    return this.connected && !!this.connection;
  }

  getCapabilities() {
    return this.agentCapabilities;
  }

  async sendMessage(text: string, images?: Array<{ mimeType: string; dataUrl: string }>) {
    if (!this.connection || !this.activeSessionId) {
      throw new Error("Not connected");
    }

    // Build prompt content
    const prompt: Array<{ type: string; text?: string; mimeType?: string; data?: string }> = [
      { type: "text", text: text },
    ];

    // Add images to prompt
    if (images && images.length > 0) {
      for (const image of images) {
        // Extract base64 data from data URL (remove data:image/png;base64, prefix)
        const base64Data = image.dataUrl.replace(/^data:[^;]+;base64,/, "");
        prompt.push({
          type: "image",
          mimeType: image.mimeType,
          data: base64Data,
        });
      }
    }

    // Send Prompt
    try {
      const response = await this.connection.prompt({
        sessionId: this.activeSessionId,
        prompt: prompt,
      });
      const usage = extractTokenUsage(response);
      if (usage) {
        this.onMessageCallback?.({
          type: "agent_info",
          info: { tokenUsage: usage },
        });
      }
      // Response is handled via sessionUpdate
    } catch (err: any) {
      console.error("Prompt error", err);
      this.onMessageCallback?.({
        type: "system",
        text: `System Error: ${err.message}`,
      });
    }
  }

  async setModel(modelId: string) {
    if (!this.connection || !this.activeSessionId) {
      throw new Error("Not connected");
    }

    try {
      await this.connection.unstable_setSessionModel({
        sessionId: this.activeSessionId,
        modelId,
      });
      this.onMessageCallback?.({
        type: "agent_info",
        info: { currentModelId: modelId },
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
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
    this.activeSessionId = null;
    this.connected = false;
    this.agentCapabilities = null;
  }
}
