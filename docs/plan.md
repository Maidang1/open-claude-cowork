下面是基于仓库源码整理的 ACP 实现分析文档（Markdown 形式，可直接保存为 .md 文件）。

AionUi ACP 实现分析
目标：梳理 ACP agent 的连接、消息处理、权限交互、文件读写、前后端链路与配置体系。

1. 入口与初始化
应用启动时初始化 ACP CLI 检测：src/index.ts 调用 initializeAcpDetector()，内部触发全局检测器 acpDetector.initialize()。见 src/process/bridge/index.ts、src/agent/acp/AcpDetector.ts。
IPC Bridge 注册 ACP 接口：src/process/bridge/acpConversationBridge.ts。
2. ACP 后端与类型定义
ACP 后端、协议方法、JSON-RPC 类型、权限请求、Session Update 等类型集中在 src/types/acpTypes.ts。
ACP_METHODS 定义 ACP 方法名（session/update、session/request_permission、fs/read_text_file、fs/write_text_file）。
ACP_BACKENDS_ALL/POTENTIAL_ACP_CLIS 描述所有 ACP CLI 支持矩阵与检测列表。
ACP 消息在统一聊天类型中体现：src/common/chatLib.ts 定义 acp_permission、acp_tool_call、agent_status 等消息类型，并在 transformMessage() 中处理。
3. ACP CLI 检测与可用 Agent 列表
检测逻辑：src/agent/acp/AcpDetector.ts
遍历 POTENTIAL_ACP_CLIS，用 which/where 检测本地 CLI。
若检测到 ACP CLI，则自动加入一个内置 Gemini 入口。
读取用户自定义 ACP agent（配置于 acp.customAgents）。
结果通过 IPC 暴露给 UI：
acp.get-available-agents、acp.detect-cli-path in src/process/bridge/acpConversationBridge.ts
IPC 端定义：src/common/ipcBridge.ts
4. 会话创建与连接生命周期（核心）
4.1 连接层：AcpConnection
文件：src/agent/acp/AcpConnection.ts

负责 spawn CLI 进程、JSON-RPC 收发、请求超时管理、文件读写回调。

支持两类连接：

Claude：使用 npx @zed-industries/claude-code-acp。
其他 ACP CLI：createGenericSpawnConfig() + --experimental-acp 或自定义 acpArgs。
连接建立流程：

spawn 子进程，绑定 stdout/stderr。
解析 stdout 行为 JSON，并分发到 handleMessage().
发送 initialize 请求。
创建 session/new。
请求超时逻辑：

session/prompt 5 分钟，其他 1 分钟。
支持暂停/恢复 session prompt 的 timeout（权限请求期间暂停）。
文件操作：

fs/read_text_file、fs/write_text_file 映射到本地 fs；
写入会通过 ipcBridge.fileStream.contentUpdate 发送预览更新。
读写路径经过 resolveWorkspacePath() 归一化。
4.2 业务层：AcpAgent
文件：src/agent/acp/index.ts

核心职责：握手 -> session -> prompt -> 会话更新 -> 转换为 UI 消息。
使用 AcpAdapter 把 ACP Session Update 转为 TMessage。
权限处理：
handlePermissionRequest() 将权限请求发给前端显示，等待用户选择后回传。
维护 pendingPermissions Map。
文档/文件引用处理：
解析消息中的 @file 引用并读取文件内容拼接到 prompt。
实现于 processAtFileReferences()。
导航工具拦截：
通过 NavigationInterceptor 拦截 chrome-devtools 的 navigate_page/new_page。
发送 preview_open 消息给 UI。
代码：src/common/navigation/NavigationInterceptor.ts
4.3 进程级管理器：AcpAgentManager
文件：src/process/task/AcpAgentManager.ts

与前端交互的“会话管理器”，负责：
初始化 ACP agent（解析 cliPath/acpArgs/customEnv）。
将 ACP 的 streaming 消息写入 DB 并通过 IPC 推给 UI。
处理首条消息注入 preset + skills 索引（prepareFirstMessageWithSkillsIndex()）。
自定义 Agent 配置：
acp.customAgents（带 defaultCliPath、acpArgs、env）。
见 src/process/initStorage.ts。
5. ACP 消息处理链路
5.1 传输链路
UI (AcpSendBox)
  -> ipcBridge.conversation.sendMessage
  -> Process Conversation Bridge
  -> AcpAgentManager.sendMessage
  -> AcpAgent.sendMessage
  -> AcpConnection.sendPrompt (JSON-RPC)
  -> CLI stdout session/update
  -> AcpConnection.handleMessage
  -> AcpAgent.handleSessionUpdate
  -> AcpAdapter.convertSessionUpdate -> TMessage
  -> ipcBridge.acpConversation.responseStream.emit
  -> UI MessageList
关键代码：

src/process/bridge/conversationBridge.ts
src/process/task/AcpAgentManager.ts
src/agent/acp/AcpConnection.ts
src/agent/acp/index.ts
src/agent/acp/AcpAdapter.ts
src/common/chatLib.ts
src/renderer/pages/conversation/acp/AcpSendBox.tsx
src/renderer/pages/conversation/acp/AcpChat.tsx
5.2 会话更新 -> UI 消息适配
src/agent/acp/AcpAdapter.ts 负责将 ACP Update 适配为 UI 消息：

agent_message_chunk -> text（流式累积）
agent_thought_chunk -> tips（thought）
tool_call / tool_call_update -> acp_tool_call（可合并更新）
plan -> plan
available_commands_update -> 文本消息
5.3 消息合并逻辑
src/common/chatLib.ts 中的 composeMessage()：

acp_tool_call 使用 toolCallId 合并。
text 使用 msg_id 流式累积。
6. ACP 权限与工具调用展示
权限请求显示组件：src/renderer/messages/acp/MessageAcpPermission.tsx
Tool call 展示组件：src/renderer/messages/acp/MessageAcpToolCall.tsx
diff 内容支持 diff 类型渲染。
权限确认回传：
UI 调用 conversation.confirmMessage -> 进程 conversationBridge -> AcpAgentManager.confirm() -> AcpAgent.confirmMessage()。
7. ACP 与工作区文件交互
ACP 读写接口由 AcpConnection.handleReadOperation() / handleWriteOperation() 实现。
写入时通过 IPC 触发预览面板刷新：
ipcBridge.fileStream.contentUpdate.emit
文件的路径归一化：
绝对路径直接使用。
相对路径绑定工作区 (resolveWorkspacePath)。
8. Skills 支持（ACP）
ACP 仅注入 skills 索引（不注入全文），由 agent 按需读取。
关键流程：
prepareFirstMessageWithSkillsIndex() in src/process/task/agentUtils.ts
AcpSkillManager in src/process/task/AcpSkillManager.ts
Skills 目录基于 getSkillsDir()，路径保存在初始化存储中。
9. UI 交互与状态反馈
ACP 会话状态 agent_status 消息通过 UI 显示：
connecting、connected、authenticated、session_active、error
AcpSendBox 中处理：
thought 节流渲染
start/finish 控制 loading
session_active 后发送“初始消息（guid page）”
入口 UI：
src/renderer/pages/conversation/acp/AcpChat.tsx
src/renderer/pages/conversation/acp/AcpSendBox.tsx
10. Worker 与可选 ACP 任务模式
src/worker/acp.ts 提供 fork 任务执行 ACP agent 的方式（目前主流程用 AcpAgentManager 直接运行，不依赖 worker 进程）。
11. 测试覆盖
tests/unit/test_custom_acp_agent.ts 覆盖：
ACP_BACKENDS_ALL 中 custom 配置
CLI path 解析与参数处理
createGenericSpawnConfig() 的行为
关键文件索引（按职责）
连接与协议：src/agent/acp/AcpConnection.ts
ACP agent 逻辑：src/agent/acp/index.ts
ACP session update 适配：src/agent/acp/AcpAdapter.ts
CLI 检测：src/agent/acp/AcpDetector.ts
进程管理：src/process/task/AcpAgentManager.ts
IPC/Bridge：src/process/bridge/acpConversationBridge.ts, src/common/ipcBridge.ts
消息类型与合并：src/common/chatLib.ts
UI 消息渲染：src/renderer/messages/acp/MessageAcpPermission.tsx, src/renderer/messages/acp/MessageAcpToolCall.tsx
UI 输入与状态：src/renderer/pages/conversation/acp/AcpSendBox.tsx
ACP 配置与内置助手：src/types/acpTypes.ts, src/process/initStorage.ts
导航拦截：src/common/navigation/NavigationInterceptor.ts
如果需要我基于这份分析继续补充“ACP 配置格式示例”、“端到端时序图”或“调用链序列图”，告诉我希望的输出形式即可。
