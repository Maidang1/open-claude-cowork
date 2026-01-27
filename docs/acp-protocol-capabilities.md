# ACP 协议能力与实现落地深度分析（面向工程集成）

> 面向：在 IDE/桌面端（Client）与各类代码 Agent（Agent/Server）之间落地 ACP（Agent Client Protocol）的工程团队。
>
> 本文结合：
> - ACP 官方文档（agentclientprotocol.com）
> - `@agentclientprotocol/sdk`（TypeScript SDK）源码实现细节
> - 本仓库（Open Claude Cowork）现有 ACP 集成代码
>
---

## 0. 背景与目标

ACP（Agent Client Protocol）是一个基于 **JSON-RPC 2.0** 的标准协议，用于在 **Client（编辑器/IDE/桌面应用）** 与 **Agent（可修改代码的 AI 代理程序）** 之间建立一致的会话模型、流式输出、工具调用、权限交互与资源访问机制。

### 0.1 术语与“稳定性”约定（阅读指南）

ACP 生态里同时存在三类“规范来源”，集成时要明确区分：

1) **Protocol / Schema（相对稳定）**：官网 `protocol/*` 与 `protocol/schema` 中的内容，通常可视为当前稳定互操作基线。

2) **RFD（提案/逐步落地，不稳定）**：官网 `rfds/*`。RFD 往往描述“未来想要的行为”，可能：
- 尚未被所有 Agent/Client 支持
- 字段/方法名仍可能调整
- 需要 capability gating 或降级策略

3) **仓库自定义扩展（本地约定）**：为了满足产品需求，在协议允许的扩展点上做的私有能力（例如自定义扩展方法）。这类能力应避免与未来标准冲突，并在文档中显式标注。

官方入口：
- 介绍：<https://agentclientprotocol.com/overview/introduction>
- 协议概览：<https://agentclientprotocol.com/protocol/overview>
- Schema：<https://agentclientprotocol.com/protocol/schema>

本文重点回答三个问题：
1. **协议层到底定义了哪些“能力”（capabilities）与交互流程？**
2. **TypeScript SDK（@agentclientprotocol/sdk）实际怎么实现 framing、路由、错误处理、连接生命周期？**
3. **本仓库实现与规范的映射关系、偏差点与落地建议。**

---

## 1. 核心角色与通信模型

- **Client**：通常是 IDE/Editor/桌面应用，负责 UI、权限弹窗、文件系统/终端等能力提供。
- **Agent**：一个进程（常见是 CLI），接收用户消息与上下文，驱动 LLM 与工具，输出计划/文本/工具调用。

ACP 采用 JSON-RPC 2.0：
- **Request**：带 `id`，需要响应（response）。
- **Notification**：不带 `id`，单向通知（no response）。

---

## 2. 传输层（Transports）：stdio + NDJSON

官方文档：<https://agentclientprotocol.com/protocol/transports>

### 2.1 规范性要求（stdio）

在 stdio transport 中：
- Client 启动 Agent 作为子进程。
- Client 将 JSON-RPC 消息写入 Agent 的 `stdin`，Agent 将消息写入 `stdout`。
- **消息以 `\n` 分隔（NDJSON），且单条消息 MUST NOT 含嵌入式换行。**
- Agent **MAY** 将日志写入 `stderr`。
- Agent **MUST NOT** 往 `stdout` 输出任何非 ACP 消息；Client **MUST NOT** 往 `stdin` 写任何非 ACP 消息。

### 2.2 TypeScript SDK 的实际 framing（ndJsonStream）

TS SDK 实现：`src/stream.ts`（commit `52f5a1f...`）
- permalink：<https://github.com/agentclientprotocol/typescript-sdk/blob/52f5a1f13b12cca3ff727793efcc9dc03ccc7087/src/stream.ts#L26-L86>

关键行为（工程含义）：
- 写出：`JSON.stringify(message) + "\n"`。
- 读取：将输入字节流增量 decode，按 `\n` split，逐行 `JSON.parse(trimmedLine)`；解析失败仅 `console.error` 并丢弃该行。
- 不做“协议级重试/回滚”：framing 依赖对端严格遵守 NDJSON。

**注意**：规范要求“消息 MUST NOT 含嵌入式换行”，其含义是 **消息本体（NDJSON 的一行）不应包含 literal newline**。在 JSON 内部的字符串中出现 `\n`（被转义）不会破坏 framing。

---

## 3. JSON-RPC 层：消息类型与错误模型

TS SDK 的 JSON-RPC 类型定义：`src/jsonrpc.ts`
- permalink：<https://github.com/agentclientprotocol/typescript-sdk/blob/52f5a1f13b12cca3ff727793efcc9dc03ccc7087/src/jsonrpc.ts>

### 3.1 消息三态

```ts
// 简化版
type Request = { jsonrpc: "2.0"; id: string|number|null; method: string; params?: unknown }
type Notification = { jsonrpc: "2.0"; method: string; params?: unknown }
type Response = { jsonrpc: "2.0"; id: string|number|null } & ({ result: unknown } | { error: { code; message; data? } })
```

### 3.2 错误码（ErrorCode）

ACP 使用 JSON-RPC 标准错误码 + ACP 扩展错误码。

在 TS SDK 生成的 schema 类型中：
- `ErrorCode` 包含 `-32700/-32600/-32601/-32602/-32603/-32000/-32002`，并**包含** `-32800`（Request cancelled），以及其它整数。
- 参考：`src/schema/types.gen.ts`（同 commit）：
  <https://github.com/agentclientprotocol/typescript-sdk/blob/52f5a1f13b12cca3ff727793efcc9dc03ccc7087/src/schema/types.gen.ts>

与 RFD 对齐：
- `$/cancel_request` + `-32800`：<https://agentclientprotocol.com/rfds/request-cancellation>

**实现注意（兼容性）**：`-32800` 目前更像是“RFD 定义并被部分实现采纳”的通用取消语义。
- 如果你在某些 Agent/Client 的 schema snapshot 里没看到 `-32800`，不要假设对端永远不会返回它；建议把它当作“可识别的取消错误”处理。
- 反过来，如果对端不支持 `-32800`，也应能通过 `session/cancel`（prompt 领域取消）完成用户侧的取消体验。

建议实现方至少把以下错误码当作“稳定语义”处理：

| code | 语义 | 常见触发 |
|---:|---|---|
| -32700 | Parse error | 非法 JSON（framing/日志污染 stdout） |
| -32600 | Invalid request | JSON-RPC Request 结构非法 |
| -32601 | Method not found | 未实现方法/未启用 capability |
| -32602 | Invalid params | 参数校验失败 |
| -32603 | Internal error | 对端执行异常 |
| -32000 | Authentication required | 需要先 authenticate |
| -32002 | Resource not found | 资源不存在（如 URI/文件） |
| -32800 | Request cancelled | 通用请求取消（RFD/部分实现） |

---

## 4. 初始化（initialize）与能力协商（Capabilities）

官方：<https://agentclientprotocol.com/protocol/initialization>

### 4.1 初始化握手

Client 连接建立后必须首先调用 `initialize`：

- Client → Agent: `initialize({ protocolVersion, clientCapabilities, clientInfo? })`
- Agent → Client: `initialize({ protocolVersion, agentCapabilities, agentInfo?, authMethods? })`

**协议版本（ProtocolVersion）只在 breaking changes 时 bump**；非 breaking 能力靠 capabilities 协商。

### 4.2 ClientCapabilities（客户端能力）

常见能力：
- `fs.readTextFile / fs.writeTextFile`：决定 Agent 是否可以调用 `fs/*` 方法。
- `terminal`：决定 Agent 是否可以调用 `terminal/*` 方法。

**扩展能力放置位置（重要）**：
- 规范倾向于：不要在 schema 类型根部随意添加自定义字段；扩展信息应通过 `_meta` 承载，避免未来字段冲突（见 Extensibility）。
- **本仓库现状**：`AcpConnection.initialize()` 里通过 `// @ts-expect-error` 在 `clientCapabilities` 顶层追加了 `runShellCommand: true` 作为扩展能力声明；这属于“工程可用但不够规范”的做法。
  - 更稳妥的方式：把扩展能力通过 `clientCapabilities._meta` 或单独的 `_open_claude_cowork/*` 扩展方法命名空间进行协商。

### 4.3 AgentCapabilities（Agent 端能力）

常见能力：
- `loadSession`：是否支持 `session/load`。
- `promptCapabilities`：是否支持 prompt 中 image/audio/resource 等 ContentBlock。
- `sessionCapabilities`：是否支持 `session/list`、`session/fork`、`session/resume` 等（多数属于 UNSTABLE/RFD）。

### 4.4 AuthMethods（认证方法）

RFD（仍在演进）：<https://agentclientprotocol.com/rfds/auth-methods>

工程建议：
- 将“认证不足”当作一种**可恢复错误**（-32000），而不是 crash。
- Client UI 需要能展示可选 auth method 并引导用户完成登录。

---

## 5. Session：会话建立、加载与演进能力

官方：<https://agentclientprotocol.com/protocol/session-setup>

### 5.1 session/new（必备）

`session/new` 创建新的对话上下文：
- `cwd`：规范要求必须是绝对路径（文档明确写了 must be absolute）。
- `mcpServers`：Agent 连接 MCP server（可选）。

**落地建议**：即使你的产品内部用 workspace 概念，也尽量在 wire-level 传绝对路径；如果确实要允许相对路径，建议通过 capability `_meta` 显式声明“相对路径语义”。

### 5.2 session/load（可选，取决于 loadSession capability）

`session/load` 用于恢复历史，并要求 Agent 将历史通过 `session/update` 流式回放给 Client。

### 5.3 UNSTABLE：session/resume / session/fork / session/list / config options

这些大多来源于 RFD 或 schema 中的 UNSTABLE 定义，集成时务必：
- **显式区分：稳定 spec vs 提案/unstable**
- 以 capability gating 为准，避免盲调

参考（RFD）：
- session-resume：<https://agentclientprotocol.com/rfds/session-resume>
- session-fork：<https://agentclientprotocol.com/rfds/session-fork>
- session-list：<https://agentclientprotocol.com/rfds/session-list>
- session-config-options：<https://agentclientprotocol.com/rfds/session-config-options>

---

## 6. Prompt Turn：一次完整交互的生命周期

官方：<https://agentclientprotocol.com/protocol/prompt-turn>

### 6.1 主流程（简化时序）

```mermaid
sequenceDiagram
  participant Client
  participant Agent

  Client->>Agent: session/prompt(id=R)
  loop until completion
    Agent-->>Client: session/update (plan / message chunk / tool calls)
    opt permission required
      Agent->>Client: session/request_permission(id=P)
      Client-->>Agent: response(id=P, outcome)
    end
  end
  Agent-->>Client: response(id=R, stopReason)
```

### 6.2 StopReason（必须返回）

当 turn 结束时，Agent **必须**对 `session/prompt` 返回 `stopReason`。

常见值（来自官方 prompt-turn & schema）：
- `end_turn`：正常结束
- `max_tokens`：达到 token 上限
- `max_turn_requests`：单次 turn 的模型请求次数上限
- `refusal`：拒绝
- `cancelled`：被 Client 取消

### 6.3 取消（session/cancel）

规范要求（摘录要点）：
- Client **MAY** 随时发送 `session/cancel`。
- Client **MUST** 对所有 pending 的 `session/request_permission` 以 outcome=cancelled 进行回应。
- Agent **SHOULD** 尽快停止模型请求与工具调用。
- Agent **MUST** 最终以 `stopReason: cancelled` 响应原始 `session/prompt`。

---

## 7. Tool Calls：工具调用与状态更新

官方：<https://agentclientprotocol.com/protocol/tool-calls>

### 7.1 两类 update

- `sessionUpdate: "tool_call"`：创建一个工具调用条目（含 toolCallId/title/kind/status 等）。
- `sessionUpdate: "tool_call_update"`：后续更新（除了 toolCallId 外字段通常可选）。

### 7.2 ToolCallStatus（状态机）

- `pending` → `in_progress` → `completed` / `failed`

### 7.3 ToolKind（类别）

官方文档给了 UI 友好的枚举（用于 icon/筛选/展示优化），常见：
- `read/edit/delete/move/search/execute/think/fetch/other`

（注意：部分实现还出现 `switch_mode` 等扩展值，Client 应对未知 kind 做兼容兜底。）

### 7.4 ToolCallContent：内容载体

工具调用结果可包含：
- `content`：标准 content block（text/image/resource 等）
- `diff`：文件修改 diff（oldText/newText/path）
- `terminal`：关联一个 terminalId，Client 负责展示实时输出

---

## 8. Permission：session/request_permission

当工具调用需要用户授权时，Agent 调用：
- `session/request_permission`（Request）

Client 返回：
- `RequestPermissionOutcome`：`cancelled` 或 `selected(optionId)`

并且规范强调：
- prompt 被 cancel 后，Client **必须**把所有 pending permission 以 cancelled 回应。

**本仓库实现备注（Open Claude Cowork）**：
- `AcpConnection.handleRunShellCommand()` 自己构造了两个 option：`optionId: "allow" | "deny"`，并通过 UI handler 返回 `outcome.selected(optionId)`。
- 这属于“私有扩展能力的权限 UI”，不代表 ACP 规范只允许这两种选项。对标准 `session/request_permission`，你仍应尽量遵循 schema 定义的 option 结构。

---

## 9. 文件系统能力（fs/*）

官方：<https://agentclientprotocol.com/protocol/file-system>

### 9.1 fs/read_text_file

请求字段：
- `path`：**绝对路径**
- `line`（1-based）/ `limit`（lines）可选

### 9.2 fs/write_text_file

请求字段：
- `path`：**绝对路径**
- `content`：写入内容

### 9.3 工程落地建议

1. **路径约束**：尽量在“线上协议层”保持绝对路径语义，避免 Client/Agent 对相对路径的约定不一致。
2. **安全**：Client 端应限制可读写范围（workspace root / allowlist），并对越权路径拒绝。

---

## 10. 终端能力（terminal/*）

官方：<https://agentclientprotocol.com/protocol/terminals>

方法：
- `terminal/create`：启动命令，返回 terminalId
- `terminal/output`：读取输出与 exitStatus（若已退出）
- `terminal/wait_for_exit`
- `terminal/kill`
- `terminal/release`

关键点：
- `outputByteLimit` 超限时，Client 需要截断输出，且必须在字符边界截断，保持 string 有效。
- terminalId 可以被嵌入 tool call content（type=terminal）用于 UI 实时展示。

---

## 11. 扩展机制（Extensibility）与 _meta 传播

官方：<https://agentclientprotocol.com/protocol/extensibility>

### 11.1 `_meta`

所有类型都带 `_meta: { [key: string]: unknown } | null`。

规范要求：
- 实现方 **MUST NOT** 在 spec 类型根部添加自定义字段（避免与未来版本冲突）。

RFD 建议（trace 互操作）：
- <https://agentclientprotocol.com/rfds/meta-propagation>
- 推荐保留根键：`traceparent` / `tracestate` / `baggage`

### 11.2 Extension methods / notifications 的命名约定

规范约定：
- 任何以 `_` 开头的方法名保留给扩展（extension methods）。
- 未识别的扩展 request：返回 -32601
- 未识别的扩展 notification：应忽略

工程建议：
- 扩展能力应通过 capabilities 的 `_meta` 字段对外声明（避免“对端不支持导致 -32601”）。

---

## 12. 通用请求取消：`$/cancel_request`（RFD / 逐步落地）

RFD：<https://agentclientprotocol.com/rfds/request-cancellation>

核心点：
- 引入可选 `$/cancel_request` notification，通过 requestId 取消单个 JSON-RPC request。
- 支持方收到后：**MUST** 取消对应 request 及其嵌套活动。
- 原请求可用 `-32800` 错误响应，或返回语义合理的“部分结果”。

与 `session/cancel` 的关系：
- `session/cancel` 是 prompt turn 领域语义的取消。
- `$/cancel_request` 是 JSON-RPC 级别的通用取消。
- 实现上可以：Client cancel prompt → Agent 内部 cascade → 对并行子请求发 `$/cancel_request`（参考 RFD 的示例时序）。

---

## 13. TypeScript SDK（@agentclientprotocol/sdk）实现要点（工程视角）

> 这部分用于解释：为什么你的实现看起来“像这样”，以及你能/不能指望 SDK 帮你做什么。

### 13.1 Connection 路由与 handler 模型

TS SDK 将 Agent/Client 两侧的 RPC handler 封装为：
- `ClientSideConnection`：站在 Client 角度，提供 `initialize/newSession/prompt/cancel/...` 等方法；同时接收来自 Agent 的 request/notification（fs、terminal、permission、update）。
- `AgentSideConnection`：站在 Agent 角度，提供 `sessionUpdate/requestPermission/readTextFile/createTerminal/...` 等方法；同时接收来自 Client 的 request/notification。

### 13.2 请求 id、pendingResponses 与写入队列

SDK 内部按自增整数分配 request id，并用 `pendingResponses` map 关联 Promise；写入侧通过 Promise 链实现顺序发送（避免并发写乱序）。

### 13.3 连接关闭语义（AbortSignal）

SDK 暴露：
- `connection.signal`：连接关闭时 abort
- `connection.closed`：连接关闭时 resolve

### 13.4 SDK 不提供“协议级 timeout”

SDK 的 `sendRequest()` 本身不做超时；超时/重试/熔断需由上层实现。

---

## 14. 本仓库（Open Claude Cowork）ACP 落地实现：能力映射与链路

### 14.1 关键文件

- `src/main/acp/AcpConnection.ts`
  - 使用 `@agentclientprotocol/sdk`：`ClientSideConnection` + `ndJsonStream`
  - 实现 client-side handlers：
    - `sessionUpdate` → 转发给 UI
    - `session/request_permission` → 弹权限并等待用户
    - `fs/read_text_file` / `fs/write_text_file` → 映射到本地 fs（以 workspace 为根做路径解析）
    - `extMethod` → 自定义 `runShellCommand`
  - 自己实现了：
    - 通用请求超时（默认 60s）
    - prompt turn 超时（5min）并在 permission 阶段 pause/resume

- `src/main/acp/AcpAgentManager.ts`
  - 管理多个 agent 连接（key = {cmd,args,env}）与 sessionId→connectionKey 映射
  - 暴露 connect/createSession/loadSession/resumeSession/setModel/stopCurrentRequest 等 API

- `src/main/acp/AcpAdapter.ts`
  - 将 `session/update` 的 update variant 转换成 UI 可消费的 `IncomingMessage`
  - 支持：`agent_message_chunk` / `agent_thought_chunk` / `tool_call` / `tool_call_update` / `plan` / `available_commands_update` / `config_option_update`
  - `extractTokenUsage()` 对 usage/tokenUsage/_meta.usage 等做启发式解析（兼容不同 agent 的字段形态）

- `src/types/acpTypes.ts`
  - 本仓库 UI/逻辑侧的 ACP 方法名常量与插件注册表（内置 qwen/claude/codex/gemini）

### 14.2 本仓库端到端链路（高层）

```mermaid
sequenceDiagram
  participant UI as Renderer(UI)
  participant IPC as IPC(Main)
  participant M as AcpAgentManager
  participant A as AcpAgent
  participant C as AcpConnection
  participant P as Agent Process

  UI->>IPC: agent:connect / agent:sendMessage
  IPC->>M: connect/sendMessage
  M->>A: connect/sendMessage
  A->>C: initialize/session/new/session/prompt
  C->>P: stdin NDJSON JSON-RPC
  P-->>C: stdout session/update
  C-->>A: onSessionUpdate
  A-->>M: IncomingMessage
  M-->>IPC: webContents.send('agent:message')
  IPC-->>UI: agent:message
```

---

## 15. 与 ACP 规范的偏差/风险点（本仓库现状）

### 15.1 扩展方法命名：`runShellCommand` 不符合 `_` 前缀约定

本仓库 `AcpConnection.ts` 在 `extMethod` 里处理 `method === "runShellCommand"`。

风险：
- ACP extensibility 文档约定扩展方法应以 `_` 开头，避免与未来 spec 冲突。
- 如果未来 ACP 定义了同名标准方法，会产生语义冲突。

建议：
- 将扩展方法改名为 `_open_claude_cowork/run_shell_command`（或类似命名空间风格），并通过 capabilities `_meta` 广播。

### 15.2 `fs/*` 的 path 语义：规范偏向绝对路径，本仓库允许相对路径并在 Client 侧 resolve

规范（schema 与文档）多处强调 `path/cwd` 为绝对路径。

本仓库：
- 使用 `resolveWorkspacePath(this.cwd, params.path)` 将相对路径绑到 workspace。

风险：
- Agent 侧如果严格按规范发绝对路径，你的 resolve 逻辑要确保不会把绝对路径当相对路径拼接。
- 多 workspace / symlink / sandbox 场景下，相对路径协议语义会变得不稳定。

建议：
- 对 wire-level：尽量强制传输绝对路径；或在 `initialize`/capabilities `_meta` 明确协商“相对路径语义”。
- Client 侧严格校验：禁止写出 workspace 之外。

### 15.3 `shell: true` spawn 可能带来注入面风险

`spawn(command, args, { shell: true })` 在拼接/转义不严密时有注入风险。

建议：
- 尽量用 `shell: false` + 明确 argv。
- 对用户可控输入（尤其是扩展 runShellCommand）做更严格的确认与限制。

### 15.4 终端能力与扩展命令的取舍

ACP 已有 `terminal/*` 作为标准能力。

本仓库目前更偏向扩展 `runShellCommand`。

建议：
- 如果 Agent 端支持 `terminal/*`，优先走标准 terminal：可获得更好的 UI（实时输出、kill/release、tool call 关联）。
- `runShellCommand` 只作为兼容兜底或特定 agent 的扩展。

---

## 16. 落地建议清单（可执行）

1. **严格 stdio NDJSON**：确保 stdout 只输出 ACP 行；日志只能走 stderr。
2. **能力协商驱动行为**：
   - 客户端发 `clientCapabilities` 时只声明自己真正支持/已实现的能力。
   - 遇到 -32601 时降级/提示，而不是直接判定 agent “坏掉”。
3. **统一取消语义**：
   - prompt-level：`session/cancel` 必做。
   - request-level：逐步支持 `$/cancel_request`（RFD）并统一用 `-32800`。
4. **路径与沙箱**：
   - wire-level 使用绝对路径；Client 做 workspace 沙箱；必要时引入 allowlist。
5. **扩展方法规范化**：
   - 方法名 `_` 前缀 + 命名空间。
   - 用 capabilities 的 `_meta` 广播扩展支持。
6. **可观测性**：
   - 支持 `_meta.traceparent/tracestate/baggage` 透传，便于跨 ACP/MCP 的 trace 关联。

---

## 17. 附录：关键枚举与常量速查

（以官方 schema/TS SDK 生成 types 为准；Client 对未知值应容错。）

### 17.1 StopReason

`end_turn | max_tokens | max_turn_requests | refusal | cancelled`

### 17.2 ToolCallStatus

`pending | in_progress | completed | failed`

### 17.3 Permission options（常见策略示例）

不同实现会把权限选项建模为不同形态（例如带“仅一次/总是允许/拒绝”的策略，或仅用 optionId 表达）。

工程上建议：
- UI 侧不要把“选项枚举”写死为某一组固定值；对未知选项应能展示 label 并回传 `optionId`。
- 对私有扩展能力（如本仓库 `runShellCommand`）可用最小模型（allow/deny）兜底。

### 17.4 RequestPermissionOutcome

- `{ outcome: "cancelled" }`
- `{ outcome: "selected", optionId: string }`

### 17.5 ErrorCode（常用）

`-32700, -32600, -32601, -32602, -32603, -32000, -32002, -32800`

---

## 18. 参考链接

- ACP Introduction：<https://agentclientprotocol.com/overview/introduction>
- Protocol Overview：<https://agentclientprotocol.com/protocol/overview>
- Transports：<https://agentclientprotocol.com/protocol/transports>
- Initialization：<https://agentclientprotocol.com/protocol/initialization>
- Session Setup：<https://agentclientprotocol.com/protocol/session-setup>
- Prompt Turn：<https://agentclientprotocol.com/protocol/prompt-turn>
- Tool Calls：<https://agentclientprotocol.com/protocol/tool-calls>
- File System：<https://agentclientprotocol.com/protocol/file-system>
- Terminals：<https://agentclientprotocol.com/protocol/terminals>
- Extensibility：<https://agentclientprotocol.com/protocol/extensibility>
- Schema：<https://agentclientprotocol.com/protocol/schema>

- RFD: Request Cancellation：<https://agentclientprotocol.com/rfds/request-cancellation>
- RFD: Meta Propagation：<https://agentclientprotocol.com/rfds/meta-propagation>
- RFD: Auth Methods：<https://agentclientprotocol.com/rfds/auth-methods>
