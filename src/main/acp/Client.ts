import { ClientSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Writable } from "node:stream";

export class ACPClient {
  private process: ChildProcess | null = null;
  private connection: ClientSideConnection | null = null;
  private onMessageCallback: ((msg: string) => void) | null = null;
  private sessionId: string | null = null;

  constructor(onMessage: (msg: string) => void) {
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
      this.onMessageCallback?.(`System: Agent process error: ${err.message}`);
    });

    this.process.on("exit", (code) => {
      console.log(`[Client] Agent exited with code ${code}`);
      this.onMessageCallback?.(`System: Agent disconnected (code ${code})`);
      this.process = null;
      this.connection = null;
      this.sessionId = null;
    });

    // Create Stream (Node -> Web Stream adapter)
    if (!this.process.stdout || !this.process.stdin) {
        throw new Error("Failed to access process streams");
    }

    // @ts-ignore
    const input = Readable.toWeb(this.process.stdout);
    // @ts-ignore
    const output = Writable.toWeb(this.process.stdin);
    const stream = ndJsonStream(output, input);

    // Create Connection
    this.connection = new ClientSideConnection(
        (agent) => ({
            requestPermission: async (params) => {
                // Auto-approve for now. Protocol expects outcome.
                // RequestPermissionResponse -> outcome: RequestPermissionOutcome
                // RequestPermissionOutcome -> { outcome: "selected", optionId: ... } | { outcome: "cancelled" }
                // We need to pick an option. Usually the request provides options.
                const options = params.options;
                const allowOption = options.find(o => o.kind === 'allow_always' || o.kind === 'allow_once');
                
                if (allowOption) {
                     return {
                        outcome: {
                            outcome: "selected",
                            optionId: allowOption.optionId
                        }
                    };
                }
                
                // Fallback to first option if no explicit allow found, or cancel
                if (options.length > 0) {
                     return {
                        outcome: {
                            outcome: "selected",
                            optionId: options[0].optionId
                        }
                    };
                }

                return { outcome: { outcome: "cancelled" } };
            },
            sessionUpdate: async (params) => {
                const update = params.update;
                if (update.sessionUpdate === 'agent_message_chunk') {
                    const content = update.content;
                    if (content.type === 'text') {
                         // Note: This might be partial text. 
                         // For this simple demo, we just print what we get.
                         // Ideally we should accumulate it in the UI.
                         this.onMessageCallback?.(`Agent: ${content.text}`);
                    }
                }
            },
            // Implement Standard FS Capabilities
            readTextFile: async (params) => {
                console.log(`[Client] readTextFile: ${params.path}`);
                try {
                    const content = await fs.readFile(path.resolve(process.cwd(), params.path), "utf-8");
                    return { content };
                } catch (e: any) {
                    throw new Error(`Failed to read file: ${e.message}`);
                }
            },
            writeTextFile: async (params) => {
                console.log(`[Client] writeTextFile: ${params.path}`);
                 try {
                    await fs.writeFile(path.resolve(process.cwd(), params.path), params.content, "utf-8");
                    return {};
                } catch (e: any) {
                    throw new Error(`Failed to write file: ${e.message}`);
                }
            },
            // Fallback for custom methods if needed
            extMethod: async (method, params: any) => {
                 console.log(`[Client] ExtMethod call: ${method}`, params);
                 return {};
            }
        }),
        stream
    );

    // Initialize Protocol
    try {
        const initResult = await this.connection.initialize({
            protocolVersion: 1,
            clientCapabilities: {
                fs: {
                    readTextFile: true,
                    writeTextFile: true
                }
            },
            clientInfo: { name: "test-client", version: "1.0.0" }
        });
        console.log("Initialized:", initResult);
        
        // New Session
        const sessionResult = await this.connection.newSession({
            cwd: process.cwd(),
            mcpServers: []
        });
        this.sessionId = sessionResult.sessionId;
        this.onMessageCallback?.("System: Connected and Session Created.");
        
    } catch (e: any) {
        console.error("Init failed:", e);
        this.onMessageCallback?.(`System: Init failed: ${e.message}`);
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
            prompt: [{ type: "text", text: text }]
        });
        // Response is handled via sessionUpdate
    } catch (err: any) {
        console.error("Prompt error", err);
        this.onMessageCallback?.(`System Error: ${err.message}`);
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
