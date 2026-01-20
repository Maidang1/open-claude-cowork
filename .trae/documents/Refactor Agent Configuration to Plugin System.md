将 Agent 配置系统重构为基于接口的设计，将硬编码的 Qwen Agent 逻辑移动到模块化的插件结构中。这将方便未来添加新的适配 ACP 协议的 Agent。

## 1. 定义 Agent 插件接口
创建 `src/render/agents/types.ts` 以定义所有 Agent 插件的契约：
```typescript
export interface AgentPlugin {
  id: string;
  name: string;
  description: string;
  packageSpec?: string; // npm 包名 (例如 "@qwen-code/qwen-code")
  defaultCommand: string; // 启动命令
  defaultEnv?: Record<string, string>;
  checkCommand?: string; // 用于检查二进制文件存在的命令
}
```

## 2. 实现 Qwen Agent 插件
创建 `src/render/agents/qwen.ts` 以封装 Qwen 特定的配置：
- 将 `DEFAULT_QWEN_COMMAND` 和相关设置移动到此处。
- 实现 `AgentPlugin` 接口。

## 3. 创建插件注册表
创建 `src/render/agents/registry.ts`：
- 导出可用插件列表（目前仅包含 Qwen）。
- 提供通过 ID 获取插件的辅助函数。

## 4. 重构 SettingsModal
更新 `src/render/SettingsModal.tsx` 使其数据驱动：
- 移除硬编码的 "Qwen" / "Custom" 切换逻辑。
- 遍历注册的插件以生成 UI 选项。
- 使用所选插件的 `packageSpec` 和 `checkCommand` 进行安装/状态检查。

## 5. 重构 NewTaskModal
更新 `src/render/NewTaskModal.tsx`：
- 用动态插件列表替换硬编码的预设选择。
- 使用插件配置来填充默认命令。

## 6. 更新 App.tsx
- 移除 `DEFAULT_QWEN_COMMAND` 等全局常量。
- 集成插件注册表以提供默认值并将插件数据传递给模态框。
