import type {
  AgentCommandInfo,
  AgentModelInfo,
  IncomingMessage,
  TokenUsage,
} from "@src/types/agentTypes";

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

export const extractTokenUsage = (payload: any): TokenUsage | null => {
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

export class AcpAdapter {
  convertSessionUpdate(sessionId: string, update: any): IncomingMessage | null {
    if (!update?.sessionUpdate) return null;

    if (update.sessionUpdate === "agent_message_chunk") {
      if (update.content?.type === "text") {
        return {
          type: "agent_text",
          sessionId,
          text: update.content.text,
        };
      }
    }

    if (update.sessionUpdate === "agent_thought_chunk") {
      if (update.content?.type === "text") {
        return {
          type: "agent_thought",
          sessionId,
          text: update.content.text,
        };
      }
    }

    if (update.sessionUpdate === "tool_call") {
      return {
        type: "tool_call",
        sessionId,
        toolCallId: update.toolCallId,
        name: update.title,
        kind: update.kind,
        status: update.status,
        rawInput: update.rawInput,
        rawOutput: update.rawOutput,
      };
    }

    if (update.sessionUpdate === "tool_call_update") {
      return {
        type: "tool_call_update",
        sessionId,
        toolCallId: update.toolCallId,
        status: update.status,
        rawInput: update.rawInput,
        rawOutput: update.rawOutput,
      };
    }

    if (update.sessionUpdate === "available_commands_update") {
      return {
        type: "agent_info",
        sessionId,
        info: {
          commands: update.availableCommands as AgentCommandInfo[],
        },
      };
    }

    if (update.sessionUpdate === "config_option_update") {
      const modelUpdate = normalizeModelsFromConfigOptions(update.configOptions);
      if (modelUpdate) {
        return {
          type: "agent_info",
          sessionId,
          info: modelUpdate,
        };
      }
    }

    if (update.sessionUpdate === "plan") {
      return {
        type: "agent_plan",
        sessionId,
        plan: update,
      };
    }

    return null;
  }
}
