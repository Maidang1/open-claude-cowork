# Claude SDK Provider Design (Event Mapping + ProviderManager + IPC)

This document specifies the event mapping for @anthropic-ai/claude-agent-sdk,
plus the ProviderManager and IPC changes for introducing a claude-sdk provider
alongside the existing ACP provider.

## Sources

- Claude Agent SDK TypeScript reference (message types, result/system/stream_event).
- Claude streaming event types and delta semantics (message_start, content_block_*,
  message_delta, message_stop, ping, error, text/tool/thinking deltas).

## Goals

- Add a second provider (claude-sdk) without sharing UI with ACP.
- Keep a unified internal message shape (IncomingMessage) for rendering and storage.
- Reuse permission flow where possible (permission_request / response).

## Provider Architecture

- AgentProvider interface (connect/send/stop/resolvePermission/...)
- AcpProvider wraps existing ACP classes.
- ClaudeProvider wraps @anthropic-ai/claude-agent-sdk query() streaming.
- ProviderManager maps taskId -> provider instance and routes IPC.

## SDK Message Types -> IncomingMessage Mapping

The TypeScript SDK emits SDKMessage unions (assistant/user/result/system/stream_event).
We map those to the app's IncomingMessage types.

| SDKMessage type              | IncomingMessage type | Mapping rule |
|-----------------------------|----------------------|--------------|
| SDKSystemMessage (init)     | system               | Emit system text like "SDK session initialized" + model/cwd summary. |
| SDKAssistantMessage         | agent_text/tool_call | Convert message.content blocks: text -> agent_text; tool_use -> tool_call (in_progress) with tool_use.id/name/input. |
| SDKUserMessage              | (no-op)              | User messages are already persisted locally; ignore or log. |
| SDKUserMessageReplay        | (no-op)              | Ignore; message replay is internal to SDK. |
| SDKResultMessage (success)  | agent_info/system    | Emit token usage (agent_info) + optional system summary (result/structured_output). |
| SDKResultMessage (error)    | system + agent_info  | Emit system error text and agent_info usage if present. |
| SDKCompactBoundaryMessage   | system               | Emit system message noting compaction boundary. |
| SDKPartialAssistantMessage  | agent_text/thought/tool_call/tool_call_update/agent_info/system | Handled by stream event mapping below. |

## Stream Event Mapping (RawMessageStreamEvent)

SDKPartialAssistantMessage carries RawMessageStreamEvent from the Anthropic SDK.
These follow the Messages API streaming events (message_start, content_block_*,
message_delta, message_stop, ping, error).

### Event: message_start

- Reset per-message buffers:
  - currentMsgId (for streaming merge)
  - content block buffers
  - tool input partial JSON buffers

### Event: content_block_start

- If content_block.type == "text":
  - Initialize text buffer for block index.
- If content_block.type == "tool_use":
  - Emit IncomingMessage:
    - type: tool_call
    - toolCallId: content_block.id
    - name: content_block.name
    - status: in_progress
    - rawInput: content_block.input (may be empty at start)
- If content_block.type == "thinking":
  - Initialize thinking buffer.

### Event: content_block_delta

Delta types (from streaming docs):

- text_delta
  - Emit IncomingMessage type agent_text with text chunk.
  - Use msg_id for merge (same msg_id per assistant stream).
- input_json_delta
  - Append delta.partial_json to tool input buffer keyed by content_block index.
  - Emit tool_call_update with rawInput = partial_json (optional, for live UI).
  - On block stop, parse full JSON to rawInput.
- thinking_delta
  - Emit IncomingMessage type agent_thought with text chunk.
  - Use msg_id to merge thought stream.
- signature_delta
  - Ignore (used for thinking integrity checks).

### Event: content_block_stop

- If block type == tool_use:
  - Parse accumulated JSON buffer -> rawInput object.
  - Emit tool_call_update with rawInput (parsed object).
- If block type == text:
  - No-op (text already streamed).

### Event: message_delta

- Extract usage if present and emit agent_info with tokenUsage.
- If stop_reason present and indicates cancellation/error:
  - Emit system message summary.

### Event: message_stop

- No-op (end of stream).

### Event: ping

- Ignore (no UI change).

### Event: error

- Emit system message with error details.

### Unknown stream events

- Log and ignore to avoid breaking on new event types.

## Permission Flow (SDK)

The SDK supports permissionMode and canUseTool in Options. We use this to
implement the same permission_request UX as ACP:

1) For tool invocation, canUseTool is called with tool input.
2) Emit IncomingMessage permission_request with:
   - id, tool, content (summary), options.
3) Resolve promise when IPC permission-response arrives.

If permissionMode is 'bypassPermissions', skip prompts and auto-approve.

## ProviderManager Design

### Responsibilities

- One provider instance per taskId.
- Create provider via ProviderFactory based on task.agentType.
- Route IPC calls to provider (connect/send/stop/permission/..).
- Maintain lightweight status (connected/sessionId/lastError) per task.

### Suggested shape

```
class ProviderManager {
  private providers = new Map<string, AgentProvider>();
  private providerMeta = new Map<string, { type: AgentProviderType; sessionId?: string | null }>();

  get(taskId): AgentProvider | null
  connect(taskId, config, options): Promise<{ success: boolean; sessionId?: string | null }>
  send(taskId, text, images?): Promise<void>
  stop(taskId): Promise<void>
  resolvePermission(taskId, id, response): void
  disconnect(taskId): Promise<void>
}
```

## IPC Changes

All IPC routes stay under "agent:*" but accept provider config. This avoids
duplicated front-end logic and keeps one message channel.

### agent:connect

```
invoke("agent:connect", taskId, {
  type: "acp" | "claude-sdk",
  payload: {...}
}, { reuseIfSame, createSession })
```

Payload examples:
- ACP: { command, cwd, env }
- Claude: { apiKey, model, cwd, options }

### agent:send

```
invoke("agent:send", taskId, text, images?)
```

### agent:stop

```
invoke("agent:stop", taskId)
```

### agent:permission-response

```
invoke("agent:permission-response", taskId, id, response)
```

### agent:get-capabilities / agent:set-model

Pass through to provider if supported; otherwise return { success:false }.

### agent:new-session / load-session / resume-session / set-active-session

- ACP: supported (as today).
- Claude: return { success:false, error:"not supported" } or no-op.

## Notes

- UI must render claude-sdk tasks in a separate chat component to satisfy
  "not coexisting with ACP in the same UI".
- For tool_use input deltas, prefer SDK helpers if available; otherwise
  accumulate partial_json and parse on content_block_stop.

