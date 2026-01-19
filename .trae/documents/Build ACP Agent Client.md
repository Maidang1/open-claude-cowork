# 构建 ACP Agent 客户端及文件系统访问功能

我将构建一个基于 ACP (Agent Client Protocol) 的聊天应用程序客户端。该程序允许用户与外部 Agent 进程对话，并赋予 Agent 访问本地文件系统的能力。

## 1. 项目设置
- 安装 `@agentclientprotocol/sdk` 和 `zod`（用于数据验证）。
- 创建 `test-agent` 目录，用于存放一个简单的 "Echo/文件系统" Agent 以供验证。

## 2. 测试 Agent (`test-agent/index.ts`)
- 使用 SDK 中的 `AgentSideConnection` 实现一个简单的 Node.js Agent。
- 该 Agent 将作为默认后端用于验证系统功能。
- 它将通过标准输入/输出 (Stdio) 进行通信。
- 它将接收用户消息，并尝试调用客户端提供的文件系统工具。

## 3. 主进程实现 (`src/main/`)
### `src/main/acp/Client.ts`
- 创建 `ACPClient` 类。
- **传输层**: 使用 Node.js `spawn` 启动 Agent 进程，并通过 `stdin`/`stdout` 通信。
- **协议**: 初始化 `ClientSideConnection`。
- **能力 (Tools)**:
  - 实现 `filesystem/listFiles` (列出文件)、`filesystem/readFile` (读取文件)、`filesystem/writeFile` (写入文件) 的处理函数。
  - 将这些能力暴露给连接的 Agent。
- **消息处理**:
  - 实现 `sendMessage(text)` 将用户输入发送给 Agent。
  - 监听 Agent 的响应（文本内容）并转发给渲染进程。
  - 监听 Agent 的请求（工具调用），在真实文件系统上执行这些操作，并将结果返回给 Agent。

### `src/main/ipc.ts`
- 处理来自渲染进程的 IPC 事件：
  - `agent:start`: 启动指定的 Agent 命令 (例如 `node path/to/agent.js`)。
  - `agent:stop`: 终止进程。
  - `agent:send`: 发送用户聊天消息。
- 发送 IPC 事件到渲染进程：
  - `agent:message`: 来自 Agent 的文本消息。
  - `agent:status`: 连接状态更新。

### `src/main/preload.ts`
- 通过 `contextBridge` 将新的 IPC 方法暴露给渲染进程。

## 4. 渲染进程实现 (`src/render/`)
- **App 组件**:
  - 添加 "连接设置"栏：输入 Agent 启动命令（默认为内置的测试 Agent）。
  - 添加聊天界面：
    - 消息历史记录（用户 vs Agent）。
    - 发送消息的输入框。
- **逻辑**:
  - 启动时（或通过按钮）连接到 Agent。
  - 显示 Agent 的回复。
  - 显示 "工具使用" 日志（可选，便于调试，例如 "Agent 正在读取文件..."）。

## 5. 验证
- 启动应用程序。
- 连接到 `test-agent`。
- 发送消息："列出当前目录下的文件。"
- 验证 Agent 是否请求了 `filesystem/listFiles`，客户端是否执行并返回了文件列表，以及 Agent 是否最终回复了文件列表内容。
