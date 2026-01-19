import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { ClientSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";

export class ACPClient {
  private process: ChildProcess | null = null;
  private connection: ClientSideConnection | null = null;
  // Callback now sends structured objects instead of strings
  private onMessageCallback: ((msg: any) => void) | null = null;
  private sessionId: string | null = null;

  constructor(onMessage: (msg: any) => void) {
    this.onMessageCallback = onMessage;
  }

  async connect(command: string, args: string[] = []) {
    if (this.process) {
      this.disconnect();
    }

    console.log(`[Client] Spawning agent: ${command} ${args.join(" ")}`);
    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "inherit"],
      shell: true,
      cwd: process.cwd(),
    });

    this.process.on("error", (err) => {
      console.error("[Client] Process error:", err);
      this.onMessageCallback?.({
        type: "system",
        text: `System: Agent process error: ${err.message}`,
      });
    });

    this.process.on("exit", (code) => {
      console.log(`[Client] Agent exited with code ${code}`);
      this.onMessageCallback?.({
        type: "system",
        text: `System: Agent disconnected (code ${code})`,
      });
      this.process = null;
      this.connection = null;
      this.sessionId = null;
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
          const allowOption = options.find(
            (o) => o.kind === "allow_always" || o.kind === "allow_once",
          );

          // Notify UI about permission request (Optional: render a decision block)
          this.onMessageCallback?.({
            type: "permission_request",
            tool: params.toolCall?.title || "Unknown Tool",
            options: options,
          });

          if (allowOption) {
            return {
              outcome: {
                outcome: "selected",
                optionId: allowOption.optionId,
              },
            };
          }

          if (options.length > 0) {
            return {
              outcome: {
                outcome: "selected",
                optionId: options[0].optionId,
              },
            };
          }

          return { outcome: { outcome: "cancelled" } };
        },
        sessionUpdate: async (params) => {
          const update = params.update;

          // Agent Text Message
          if (update.sessionUpdate === "agent_message_chunk") {
            if (update.content.type === "text") {
              this.onMessageCallback?.({ type: "agent_text", text: update.content.text });
            }
          }
          // Agent Thought
          else if (update.sessionUpdate === "agent_thought_chunk") {
            if (update.content.type === "text") {
              this.onMessageCallback?.({ type: "agent_thought", text: update.content.text });
            }
          }
          // Tool Call
          else if (update.sessionUpdate === "tool_call") {
            this.onMessageCallback?.({
              type: "tool_call",
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
              toolCallId: update.toolCallId,
              status: update.status,
            });
          }
        },
        readTextFile: async (params) => {
          console.log(`[Client] readTextFile: ${params.path}`);
          this.onMessageCallback?.({ type: "tool_log", text: `Reading file: ${params.path}` });
          try {
            const content = await fs.readFile(path.resolve(process.cwd(), params.path), "utf-8");
            return { content };
          } catch (e: any) {
            throw new Error(`Failed to read file: ${e.message}`);
          }
        },
        writeTextFile: async (params) => {
          console.log(`[Client] writeTextFile: ${params.path}`);
          this.onMessageCallback?.({ type: "tool_log", text: `Writing file: ${params.path}` });
          try {
            await fs.writeFile(path.resolve(process.cwd(), params.path), params.content, "utf-8");
            return {};
          } catch (e: any) {
            throw new Error(`Failed to write file: ${e.message}`);
          }
        },
        extMethod: async (method, params: any) => {
          console.log(`[Client] ExtMethod call: ${method}`, params);
          return {};
        },
      }),
      stream,
    );

    // Initialize Protocol
    try {
      const initResult = await this.connection.initialize({
        protocolVersion: 1,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
        },
        clientInfo: { name: "test-client", version: "1.0.0" },
      });
      console.log("Initialized:", initResult);

      // New Session
      const sessionResult = await this.connection.newSession({
        cwd: process.cwd(),
        mcpServers: [],
      });
      this.sessionId = sessionResult.sessionId;
      this.onMessageCallback?.({ type: "system", text: "System: Connected and Session Created." });
    } catch (e: any) {
      console.error("Init failed:", e);
      this.onMessageCallback?.({ type: "system", text: `System: Init failed: ${e.message}` });
      this.disconnect();
      throw e;
    }
  }

  async sendMessage(text: string) {
    if (!this.connection || !this.sessionId) {
      throw new Error("Not connected");
    }

    // Send Prompt
    try {
      await this.connection.prompt({
        sessionId: this.sessionId,
        prompt: [{ type: "text", text: text }],
      });
      // Response is handled via sessionUpdate
    } catch (err: any) {
      console.error("Prompt error", err);
      this.onMessageCallback?.({ type: "system", text: `System Error: ${err.message}` });
    }
  }

  disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connection = null;
    this.sessionId = null;
  }
}
