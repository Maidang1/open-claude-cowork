import { AgentSideConnection, ndJsonStream } from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";

async function main() {
  // Adapt Node streams to Web Streams
  // @ts-ignore
  const input = Readable.toWeb(process.stdin);
  // @ts-ignore
  const output = Writable.toWeb(process.stdout);

  const stream = ndJsonStream(output, input);

  const connection = new AgentSideConnection(
    (conn) => ({
      initialize: async (params) => {
        return {
          protocolVersion: 1,
          agentCapabilities: {
              sessionCapabilities: {},
              promptCapabilities: {}
          },
          agentInfo: { name: "test-agent", version: "1.0.0" }
        } as any;
      },
      newSession: async (params) => {
        return { 
            sessionId: "session-1",
            modes: { availableModes: [], currentModeId: "default" },
            models: { availableModels: [], currentModelId: "default" },
            configOptions: []
        } as any;
      },
      authenticate: async () => {
          return { success: true } as any; // Mock
      },
      prompt: async (params) => {
        // params.prompt is array of ContentBlock
        // Find first text block
        const textBlock = params.prompt.find((b: any) => b.type === 'text');
        const userMessage = textBlock ? textBlock.text : "";

        console.error(`[Agent] Received prompt: ${userMessage}`);

        // Send response via sessionUpdate (chunks)
        // 1. Send Agent Message Chunk
        await conn.sessionUpdate({
            sessionId: params.sessionId,
            update: {
                sessionUpdate: "agent_message_chunk",
                content: {
                    type: "text",
                    text: `Echo: ${userMessage}`
                }
            }
        });

        if (userMessage.includes("list") && userMessage.includes("file")) {
            try {
                // Call Client capability: fs/read_text_file? 
                // Wait, client advertised fs.readTextFile/writeTextFile
                // But there is no standard "listFiles" capability in the schema I saw?
                // The schema has `fs_read_text_file` and `fs_write_text_file`.
                // No list files.
                // So I must use `extMethod` for listFiles if I want to use it.
                // But my client implements `readTextFile` as a standard method now.
                // Let's try to read `package.json` to prove FS access.
                
                await conn.sessionUpdate({
                    sessionId: params.sessionId,
                    update: {
                        sessionUpdate: "agent_message_chunk",
                        content: { type: "text", text: "\nReading package.json..." }
                    }
                });

                const result = await conn.readTextFile({
                    sessionId: params.sessionId,
                    path: "package.json"
                });
                
                await conn.sessionUpdate({
                     sessionId: params.sessionId,
                     update: {
                        sessionUpdate: "agent_message_chunk",
                        content: { type: "text", text: `\nContent preview: ${result.content.substring(0, 50)}...` }
                     }
                });

            } catch (e: any) {
                 await conn.sessionUpdate({
                     sessionId: params.sessionId,
                     update: {
                        sessionUpdate: "agent_message_chunk",
                        content: { type: "text", text: `\nError accessing FS: ${e.message}` }
                     }
                });
            }
        }

        return {
          stopReason: "end_turn"
        };
      },
      cancel: async () => {},
    }),
    stream
  );

  console.error("[Agent] Started");
  await connection.closed;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
