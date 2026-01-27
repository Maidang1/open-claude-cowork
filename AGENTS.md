# AGENTS.md (open-claude-cowork)

本文档提供给在本仓库运行的 agentic coding agents（含代码生成/修改代理）。目标：让代理能**快速、可重复**地在本项目里开发、检查、构建，并遵循既有代码风格。

> 说明：本仓库未发现 Cursor/Copilot 规则文件：
> - 未找到 `.cursor/rules/**`
> - 未找到 `.cursorrules`
> - 未找到 `.github/copilot-instructions.md`

## 1) 常用命令（Build / Lint / Test）

### 安装依赖

```bash
pnpm install
```

CI（GitHub Actions）使用：`pnpm install --frozen-lockfile`（见 `.github/workflows/build.yml`）。

### 开发（Dev）

```bash
# 同时启动渲染进程 + 主进程（通过 plopfile.js 串起 dev:render -> dev:main）
pnpm run dev

# 仅启动渲染进程（Rsbuild）
pnpm run dev:render

# 仅启动主进程（Nodemon，内部会 rebuild:main）
pnpm run dev:main
```

相关实现：
- `package.json` scripts
- `builder/rsbuild.render.ts`（dev middleware 里 spawn `npm run dev:main`）
- `nodemon.json`（watch `src/main/**/*`，exec `npm run rebuild:main`）

### 构建（Build）

```bash
# 交互式选择平台（实际由 plopfile.js 触发 builder/build:main + build:render + electron-builder）
pnpm run build

# 平台快捷脚本（非交互）
pnpm run build:darwin
pnpm run build:mac-x64
pnpm run build:mac-arm64
pnpm run build:win32
pnpm run build:linux

# 仅构建主进程 / 渲染进程
pnpm run build:main
pnpm run build:render

# 构建并运行生产产物（用于本地验证）
pnpm run rebuild:main
```

构建/打包关键文件：
- `plopfile.js`：决定 dev/build 流程、ENV_FILE/BUILD_TARGET/BUILD_ARCH
- `builder/rsbuild.main.ts`、`builder/rsbuild.render.ts`、`builder/rsbuild.common.ts`
- `builder.js`：electron-builder 配置（读取 `env/.env*`，用 `BUILD_ENV`/`BUILD_TARGET` 等）
- `.github/workflows/build.yml`：release 构建矩阵

环境变量（示例）：`env/.env.example`。

### Lint / Format（Biome）

项目使用 Biome（见 `biome.json`），仓库脚本：

```bash
# 对 src 运行检查并自动修复（格式化 + lint + import sorting）
pnpm run lint
```

更细粒度（来自 Biome 官方 CLI 文档 https://biomejs.dev/reference/cli/）：

```bash
# 仅检查，不写入
pnpm exec biome check ./src

# 修复单个文件/目录
pnpm exec biome check --write ./src/main/index.ts
pnpm exec biome check --write ./src/render

# 只 format / 只 lint（如需）
pnpm exec biome format --write ./src
pnpm exec biome lint --write ./src
```

Biome 配置摘要（`biome.json`）：2 空格缩进、双引号、行宽 100；部分 a11y/security/any 规则关闭。

### TypeScript 类型检查

本仓库未提供 `typecheck` script；如需本地类型检查，可用：

```bash
pnpm exec tsc -p tsconfig.json --noEmit
```

### Tests（Vitest）

本仓库已接入 Vitest（单元测试 + React 组件/Hook 测试，jsdom 环境）。

```bash
# 跑全部测试（交互/监听）
pnpm test

# CI/一次性跑完
pnpm run test:run

# 监听模式
pnpm run test:watch

# 跑单个测试文件
pnpm exec vitest run src/render/utils/wallpaper.test.ts

# 按用例名过滤（支持正则）
pnpm exec vitest run -t "useEscapeKey"
```

配置文件：`vitest.config.ts`；setup：`src/render/test/setup.ts`。

## 2) 代码风格与工程约定（Code Style）

### 总体

- 语言：TypeScript（`tsconfig.json` strict=true）。
- 运行时：Electron（主进程 `src/main` + preload + 渲染进程 `src/render`）。
- UI：React 19 + Tailwind（`src/render/tailwind.css`、`tailwind.config.ts`）。

### 格式化与引号

- 交给 Biome：不要手写格式化规则。
- 双引号（`biome.json` -> `javascript.formatter.quoteStyle = "double"`）。
- 缩进 2 空格；lineWidth=100。

### Imports / 模块边界

- 使用 ES Module `import`（例如 `src/main/index.ts`、`src/main/acp/AcpConnection.ts`）。
- 使用 Node 内置模块 `node:` 前缀（例如 `import fs from "node:fs/promises"`）。
- 支持 TS path aliases（`tsconfig.json`）：`@src/*`、`@main/*`、`@render/*`、`@components/*`。
- 类型导入优先 `import type ...`（例如 `src/main/acp/AcpConnection.ts`、`src/render/components/Sidebar.tsx`）。

> 注意：代码里存在少量 CommonJS `require`（例如 `src/render/components/Sidebar.tsx`），但总体风格以 ESM 为主。新增代码优先使用 `import`。

### Exports

- 本仓库既有 named export，也有 default export（例如 `src/render/AppNew.tsx`、`tailwind.config.ts` 使用 default）。
- 新增模块：
  - 若模块有多个导出：使用命名导出。
  - 若模块仅一个主要导出（App/配置）：可用 default。

### 命名与文件结构

- 主进程：`src/main/**`（IPC：`src/main/ipc/**`；ACP：`src/main/acp/**`；DB：`src/main/db/**`）。
- 渲染进程：`src/render/**`（components/hooks/utils/types）。
- React 组件文件多为 `UpperCamelCase.tsx`（如 `MessageRenderer.tsx`、`SettingsModal.tsx`）。

### TypeScript 类型与错误抑制

- `tsconfig.json`：`noUnusedLocals/noUnusedParameters/noImplicitReturns` 开启。
- 避免 `any`；优先 `unknown` + type guard。仓库里存在 `as any`（例如 `src/main/acp/AcpConnection.ts`、`src/render/components/MessageRenderer.tsx`），新增代码尽量减少。
- `@ts-expect-error` 允许但必须写明原因（例：`src/main/acp/AcpConnection.ts` 对协议扩展的注释）。

### 错误处理与日志

- 主进程/基础设施层多用 `throw new Error("...")` 传播错误（例如 `src/main/acp/AcpAgentManager.ts`、`src/main/acp/AcpConnection.ts`）。
- IPC handlers 通常捕获异常并返回 `{ success: false, error: ... }`（例如 `src/main/ipc/agent.ts`）。
- 日志：
  - 运行期多使用 `console.*`（DB/安装流程/IPC）
  - 更新器使用 `electron-log`（`src/main/ipc/updater.ts`）

建议：
- 给用户可见的错误使用可理解的 message；避免吞错。
- 不要写空的 `catch {}`；如需忽略必须注释原因。

### React 约定

- 函数组件 + Hooks（例如 `src/render/components/*`）。
- Hook 仅在组件/自定义 hook 顶层调用。
- Tailwind className 为主（见 `src/render/components/Sidebar.tsx`）。

## 3) Electron / IPC 安全与边界（建议）

（来自 Electron 官方安全/Context Isolation 指南；保持保守）

- 保持 `contextIsolation: true`、`nodeIntegration: false`（当前已如此：`src/main/index.ts`）。
- preload 里用 `contextBridge.exposeInMainWorld` 暴露**最小** API；避免把 `ipcRenderer` 原样透传（当前 `src/main/preload.ts` 暴露了 send/invoke/on；新增 API 建议更细粒度）。
- IPC handler 要做输入校验；必要时校验 sender/frame 来源（尤其是可执行命令/文件系统相关能力）。
- 渲染进程永远不直接访问 Node/Electron 内部 API；统一走 preload + IPC。
