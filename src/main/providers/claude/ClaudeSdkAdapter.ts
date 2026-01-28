import type { IncomingMessage, TokenUsage } from "@src/types/agentTypes";

type StreamEvent = {
  type?: string;
  content_block?: any;
  index?: number;
  delta?: any;
  message?: any;
  usage?: any;
  stop_reason?: string | null;
  error?: { message?: string };
};

const extractTokenUsage = (payload: any): TokenUsage | null => {
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
    if (!candidate || typeof candidate !== "object") continue;
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

export class ClaudeSdkAdapter {
  private toolInputBuffers = new Map<string, string>();

  resetStream() {
    this.toolInputBuffers.clear();
  }

  handleSdkMessage(message: any): IncomingMessage[] {
    if (!message || typeof message !== "object") return [];

    if (message.type === "stream_event") {
      return this.handleStreamEvent(message.event ?? message);
    }

    if (message.type === "system") {
      return [
        {
          type: "system",
          text: message.content || "System: SDK system message.",
        },
      ];
    }

    if (message.type === "assistant") {
      const out: IncomingMessage[] = [];
      const blocks = Array.isArray(message.content) ? message.content : [];
      for (const block of blocks) {
        if (block?.type === "text") {
          out.push({ type: "agent_text", text: block.text ?? "" });
        } else if (block?.type === "thinking") {
          out.push({ type: "agent_thought", text: block.text ?? "" });
        } else if (block?.type === "tool_use") {
          out.push({
            type: "tool_call",
            toolCallId: block.id,
            name: block.name,
            status: "in_progress",
            rawInput: block.input,
          });
        }
      }
      return out;
    }

    if (message.type === "result") {
      const usage = extractTokenUsage(message);
      const out: IncomingMessage[] = [];
      if (usage) {
        out.push({ type: "agent_info", info: { tokenUsage: usage } });
      }
      if (message.error) {
        out.push({ type: "system", text: `System Error: ${message.error?.message || "Unknown"}` });
      }
      return out;
    }

    return [];
  }

  handleStreamEvent(event: StreamEvent): IncomingMessage[] {
    if (!event || typeof event !== "object") return [];
    const eventType = event.type;
    const out: IncomingMessage[] = [];

    if (eventType === "message_start") {
      this.resetStream();
      return out;
    }

    if (eventType === "content_block_start") {
      const block = event.content_block;
      if (block?.type === "tool_use") {
        const toolId = block.id || `${event.index ?? "tool"}-${Date.now()}`;
        const input = block.input ?? {};
        if (typeof input === "string") {
          this.toolInputBuffers.set(toolId, input);
        }
        out.push({
          type: "tool_call",
          toolCallId: toolId,
          name: block.name,
          status: "in_progress",
          rawInput: input,
        });
      }
      return out;
    }

    if (eventType === "content_block_delta") {
      const delta = event.delta || {};
      if (delta.type === "text_delta") {
        out.push({ type: "agent_text", text: delta.text ?? "" });
      } else if (delta.type === "thinking_delta") {
        out.push({ type: "agent_thought", text: delta.text ?? "" });
      } else if (delta.type === "input_json_delta") {
        const toolId = event.content_block?.id;
        if (toolId) {
          const prev = this.toolInputBuffers.get(toolId) ?? "";
          const next = `${prev}${delta.partial_json ?? ""}`;
          this.toolInputBuffers.set(toolId, next);
          out.push({
            type: "tool_call_update",
            toolCallId: toolId,
            rawInput: next,
          });
        }
      }
      return out;
    }

    if (eventType === "content_block_stop") {
      const block = event.content_block;
      if (block?.type === "tool_use") {
        const toolId = block.id;
        if (toolId) {
          const raw = this.toolInputBuffers.get(toolId);
          if (raw) {
            let parsed: any = raw;
            try {
              parsed = JSON.parse(raw);
            } catch {}
            out.push({
              type: "tool_call_update",
              toolCallId: toolId,
              rawInput: parsed,
            });
          }
        }
      }
      return out;
    }

    if (eventType === "message_delta") {
      const usage = extractTokenUsage(event.usage ?? event.message?.usage);
      if (usage) {
        out.push({ type: "agent_info", info: { tokenUsage: usage } });
      }
      if (event.stop_reason) {
        out.push({
          type: "system",
          text: `System: Prompt stopped (${event.stop_reason}).`,
        });
      }
      return out;
    }

    if (eventType === "error") {
      out.push({
        type: "system",
        text: `System Error: ${event.error?.message || "Unknown streaming error."}`,
      });
      return out;
    }

    return out;
  }
}
