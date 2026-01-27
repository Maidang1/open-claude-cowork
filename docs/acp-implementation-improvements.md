# ACP 实现改进分析报告

## 1) 执行摘要（Top 5）

本报告对当前项目中 ACP (Agent Client Protocol) 的实现进行了深入分析，旨在识别潜在问题并提出改进建议。主要发现和建议如下：

1.  **安全漏洞显著**: 当前 ACP 代理通过 `runShellCommand` 扩展执行 Shell 命令，且 `spawn` 带有 `shell: true`，结合文件路径解析允许 `~` 扩展和绝对路径，构成了严重的安全风险。代理可能执行任意系统命令并访问任意文件。
2.  **协议合规性不足**: 核心功能（如 Shell 命令执行）通过自定义扩展而非 ACP 规范中定义的 `terminal/*` 方法实现，增加了互操作性和维护成本。
3.  **错误处理待增强**: 尽管存在权限请求，但 `execAsync` 的错误处理相对基础，可能不足以应对所有边缘情况，且 `onPermissionRequest` 异常路径需关注。
4.  **用户体验影响**: 权限请求当前以阻塞方式处理，可能影响代理执行的流畅性。
5.  **可维护性挑战**: 项目中存在 Biome Linting 错误，提示代码质量问题，且自定义协议扩展增加了未来升级和兼容性的难度。

## 2) 当前实现链路图（Main/IPC/Renderer）

当前 ACP 实现的链路主要涉及主进程 (Main Process) 的 ACP 客户端、IPC 通道和渲染进程 (Renderer Process) 的 UI 交互。

1.  **代理连接**: 渲染进程通过 `agent:connect` IPC 启动 ACP 代理连接。
2.  **代理消息**: 代理与主进程之间通过 `agent:message` IPC 通道进行通信，传递 ACP 协议消息。
3.  **停止请求**: 渲染进程通过 `agent:stop` IPC 发送停止当前代理请求的指令。
4.  **权限请求与响应**:
    *   当代理需要执行敏感操作 (例如 `runShellCommand`) 时，主进程会触发一个权限请求。
    *   主进程 (在 `AcpConnection.ts` 中) 调用 `handlers.onPermissionRequest`，这会通过 IPC 传递给渲染进程。
    *   渲染进程的 `MessageAcpPermission` 组件 (在 `src/render/components/MessageAcpPermission.tsx` 中) 负责展示权限请求 UI。
    *   用户在 UI 中做出选择后，渲染进程通过 `agent:permission-response` IPC (`AppNew.tsx` 中调用) 将响应发送回主进程，主进程的 `AcpAgent` (`pendingPermissions` Map) 处理该响应，并决定是否允许操作。

**核心 IPC 通道**:
*   `agent:connect`
*   `agent:message`
*   `agent:stop`
*   `agent:permission-response`

## 3) 问题与差距（按主题分组）

### Security (安全)

*   **任意 Shell 命令执行**: 代理可以通过 `runShellCommand` 扩展执行任意 Shell 命令，且 `spawn` 选项 `shell: true` 进一步增加了命令注入的风险。这意味着恶意代理或被入侵的代理可能完全控制用户系统。
*   **文件系统路径解析漏洞**: `resolveWorkspacePath` 函数在处理代理提供的路径时，会扩展 `~` 为用户主目录，并允许绝对路径。这绕过了工作区沙箱，使得代理可以访问用户系统中的任意位置。

### Spec compliance (协议合规性)

*   **自定义协议扩展**: `runShellCommand` 作为协议扩展通过 `@ts-expect-error` 声明并广告给代理。虽然 ACP 允许扩展，但首选 `terminal/*` 方法来执行 Shell 命令。这种自定义扩展降低了与其他 ACP 实现的互操作性。
*   **缺少 Terminal Spec 实现**: 经检查，当前代码库中未实现 ACP 规范中定义的 `terminal/*` 相关方法。

### Reliability (可靠性)

*   **基础的错误处理**: `execAsync` 的错误处理仅捕获了 `Error` 对象，并返回 `stderr` 和 `exitCode`。对于更复杂的错误场景（如资源耗尽、超时等），可能需要更细致的处理。
*   **权限请求异常**: 如果 `onPermissionRequest` 回调在主进程中抛出未捕获的异常，可能会导致代理请求挂起或崩溃。

### UX (用户体验)

*   **阻塞式权限请求**: 权限请求以同步阻塞的方式处理，用户必须在 UI 中手动响应才能使代理继续执行。这在代理执行长时间任务时可能造成体验中断。

### Observability (可观测性)

*   **基础日志记录**: 日志主要通过 `console.log` 进行，缺乏结构化日志、日志级别管理和可配置的日志目的地，不利于调试和生产环境监控。

### Maintainability (可维护性)

*   **Biome Linting 错误**: 根据 `issues.md` 记录，`src/main/ipc/agent.ts` 存在 Biome Parse Error。这表明代码可能存在语法问题或不符合 Biome 规范，阻碍了代码质量工具的有效运行。
*   **自定义扩展的维护成本**: 自定义 `runShellCommand` 扩展意味着未来 ACP 规范更新时，需要手动维护兼容性，增加了维护负担。

## 4) P0/P1/P2 路线图（表格）

| 优先级 | 任务描述 | 估算工作量 | 影响 | 风险 | 验收标准 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P0** | **消除任意 Shell 命令执行安全漏洞** | 3-5 天 | 极高 | 低 | 代理无法执行除白名单外的任意 Shell 命令；`shell: true` 被移除；文件系统路径受严格限制。 |
| **P0** | **强化文件系统沙箱** | 2-3 天 | 极高 | 低 | `resolveWorkspacePath` 不再扩展 `~` 或允许绝对路径；代理的文件系统访问严格限制在指定工作区内。 |
| **P1** | **实施 ACP `terminal/*` 规范** | 5-7 天 | 高 | 中 | 代理使用标准 `terminal/*` 方法而非自定义 `runShellCommand`；现有 `runShellCommand` 扩展被废弃或修改为仅支持极受限的操作。 |
| **P1** | **改进权限请求的用户体验** | 3-4 天 | 中 | 低 | 权限请求采用非阻塞或更智能的提示方式，减少对代理流程的干扰。 |
| **P1** | **增强错误处理与恢复机制** | 2-3 天 | 中 | 低 | 针对 `execAsync` 和 `onPermissionRequest` 增加更健壮的错误捕获、重试或用户通知机制。 |
| **P2** | **集成结构化日志系统** | 3-5 天 | 中 | 低 | 所有关键操作和错误均通过结构化日志输出，支持日志级别和可配置的输出目标。 |
| **P2** | **深层文件系统沙箱防御** | 3-4 天 | 中 | 中 | 额外防御（如符号链接攻击、Docker 容器隔离）以确保代理无法突破沙箱。 |

## 5) Quick wins（< 1 天）清单

1.  **移除 `spawn` 中的 `shell: true`**: 对于代理发起的 Shell 命令，优先通过 `command` 和 `args` 数组精确控制，移除 `shell: true` 以减少命令注入风险。
2.  **禁止 `resolveWorkspacePath` 扩展 `~` 和绝对路径**: 修改 `resolveWorkspacePath`，使其仅处理相对工作区的路径，禁止用户输入中的 `~` 扩展和绝对路径。
3.  **修复 `src/main/ipc/agent.ts` 的 Biome Linting 错误**: 解决 `issues.md` 中提到的 Biome 解析错误，确保代码质量工具正常运行。

## 6) 设计提案（中长期）

### Prefer ACP `terminal/*` over custom shell command extension

强烈建议将当前自定义的 `runShellCommand` 扩展替换为 ACP 规范中定义的 `terminal/*` 方法。

*   **标准化**: 使用标准协议有助于与其他 ACP 客户端和代理实现更好的互操作性，减少自定义实现的维护成本。
*   **安全性**: 协议通常会考虑安全最佳实践，通过标准化接口可以更好地利用社区审查和改进。
*   **功能对齐**: ACP `terminal/*` 方法通常提供更丰富的控制和状态报告，有助于构建更健壮的终端交互体验。

### Tight filesystem sandboxing

当前的文件系统访问机制存在严重漏洞。应实施严格的文件系统沙箱策略：

1.  **白名单路径**: 代理只能访问明确列入白名单的特定目录或文件。所有其他路径访问都将被拒绝。
2.  **禁止 `~` 扩展**: 彻底禁止 ACP 代理提交的任何路径中包含 `~` 字符，或任何尝试扩展到用户主目录的行为。
3.  **禁止绝对路径**: 代理提交的路径必须是相对于其指定工作区的相对路径，禁止使用 `/` 或 `C:\` 开头的绝对路径。
4.  **符号链接防御**: 警惕符号链接攻击，确保代理无法通过创建或利用符号链接来突破沙箱限制。
5.  **进程隔离**: 考虑将代理的 Shell 执行环境通过容器（如 Docker 或类似技术）进一步隔离，提供更强大的沙箱保护。

### Spec-aligned extension naming ("_" prefix + namespace) and advertise via `_meta`

如果确实需要自定义扩展，应遵循 ACP 规范的命名约定，即使用 `_` 前缀并考虑命名空间。例如，`_myOrg_runShellCommand` 或 `_vendor/runShellCommand`。这些扩展应通过 `_meta` 字段在 `initialize` 阶段进行广告，而不是直接作为顶级能力字段。这有助于明确区分标准协议能力和自定义扩展，提高可读性和未来兼容性。

## 7) Evidence（证据）

### `resolveWorkspacePath` 扩展 `~` 和允许绝对路径

文件: `src/main/acp/paths.ts` (行 4-13) - 片段 A: 处理路径裁剪与 `~` 扩展
```typescript
export const resolveWorkspacePath = (workspace: string, targetPath: string) => {
  const trimmed = targetPath.trim();
  if (!trimmed) {
    return path.resolve(workspace);
  }

  let normalized = trimmed;
  if (normalized.startsWith("~")) {
    normalized = path.join(os.homedir(), normalized.slice(1));
  }
};
```

文件: `src/main/acp/paths.ts` (行 15-20) - 片段 B: 处理绝对路径与相对路径解析
```typescript
  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }

  return path.resolve(workspace, normalized);
};
```

### `spawn(..., shell: true)` 在 `AcpConnection.connect` 中

文件: `src/main/acp/AcpConnection.ts` (行 58-63)
```typescript
    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      cwd: this.cwd,
      env: env ? { ...process.env, ...env } : process.env,
    });
```

### `runShellCommand` 经由 `extMethod` 路由

文件: `src/main/acp/AcpConnection.ts` (行 142-147)
```typescript
        extMethod: async (method, params: any) => {
          if (method === "runShellCommand") {
            return this.handleRunShellCommand(params);
          }
          return {};
        },
```

### `runShellCommand` 权限门控与 `execAsync` 执行

文件: `src/main/acp/AcpConnection.ts` (行 153-157) - 片段 A: 命令验证
```typescript
  private async handleRunShellCommand(params: any) {
    const command = typeof params?.command === "string" ? params.command : "";
    if (!command) {
      throw new Error("Missing shell command");
    }
```

文件: `src/main/acp/AcpConnection.ts` (行 159-172) - 片段 B: 权限请求
```typescript
    this.pausePromptTimeout();
    let response: any;
    try {
      response = await this.handlers.onPermissionRequest({
        tool: "runShellCommand",
        content: `Request to run shell command:\n${command}`,
        options: [
          { optionId: "allow", label: "Allow" },
          { optionId: "deny", label: "Deny" },
        ],
      });
    } finally {
      this.resumePromptTimeout();
    }
```

文件: `src/main/acp/AcpConnection.ts` (行 174-185) - 片段 C: 命令执行与错误处理
```typescript
    if (response?.outcome?.outcome === "selected" && response.outcome.optionId === "allow") {
      this.handlers.onToolLog?.(`Executing shell command: ${command}`);
      try {
        const { stdout, stderr } = await execAsync(command, { cwd: this.cwd });
        return { stdout, stderr, exitCode: 0 };
      } catch (e: any) {
        return { stdout: "", stderr: e.message, exitCode: e.code || 1 };
      }
    }

    throw new Error("User denied shell command execution");
  }
```

### `initialize` 广告 `runShellCommand: true` 并带有 `@ts-expect-error`

文件: `src/main/acp/AcpConnection.ts` (行 191-201)
```typescript
    const initResult = await this.withTimeout(
      this.connection.initialize({
        protocolVersion: 1,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
          // @ts-expect-error - protocol extension handled by agent
          runShellCommand: true,
        },
```

### 渲染进程 `agent:permission-response` IPC 调用

文件: `src/main/ipc/agent.ts` (行 246-248)
```typescript
  ipcMain.handle("agent:permission-response", (_, id: string, response: any) => {
    acpManager?.resolvePermission(id, response);
  });
```

### 渲染进程 `agent:stop` IPC 调用

文件: `src/main/ipc/agent.ts` (行 330-335)
```typescript
  ipcMain.handle("agent:stop", async () => {
    if (!acpManager) {
      return { success: true };
    }
    return await acpManager.stopCurrentRequest();
  });
```

### `AcpAgent` 中的 `pendingPermissions` Map

文件: `src/main/acp/AcpAgent.ts` (行 37)
```typescript
  private pendingPermissions = new Map<string, (response: any) => void>();
```

### `AcpAgent.stopCurrentRequest()` 调用 `AcpConnection.cancel()`

文件: `src/main/acp/AcpAgent.ts` (行 157-162)
```typescript
  async stopCurrentRequest() {
    if (!this.connection || !this.activeSessionId) {
      return;
    }
    try {
      await this.connection.cancel(this.activeSessionId);
```

### `MessageAcpPermission.tsx` 中的 UI 逻辑

文件: `src/render/components/MessageAcpPermission.tsx` (行 9-16)
```typescript
export const MessageAcpPermission = ({ msg, onPermissionResponse }: MessageAcpPermissionProps) => {
  const { id: permissionId, tool, content, options, command } = msg.content;

  const handleAccept = (optionId: string | null) => {
    if (permissionId) {
      onPermissionResponse(permissionId, optionId);
    }
  };
```

### `AppNew.tsx` 中调用 `agent:permission-response`

文件: `src/render/AppNew.tsx` (行 268-274)
```typescript
  const handlePermissionResponse = useCallback(
    async (permissionId: string, optionId: string | null) => {
      const response = optionId
        ? { outcome: { outcome: "selected", optionId } }
        : { outcome: { outcome: "cancelled" } };
      await window.electron.invoke("agent:permission-response", permissionId, response);
    },
    [],
```

### `terminal` 规范未实现

在 `src` 目录中未找到 `terminal/` 相关方法和能力广告，表明 ACP 规范中的 `terminal` 功能未被实现。

### `src/main/ipc/agent.ts` 中的 Biome Parse Errors

根据 `.sisyphus/notepads/acp-improvements/issues.md` 记录，`src/main/ipc/agent.ts` 存在 Biome Parse Errors，这影响了代码质量检查和可维护性。
