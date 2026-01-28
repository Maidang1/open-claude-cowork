# Tauri Sidecar 迁移状态记录

> 基于 `TAURI_MIGRATION_PLAN.md` 的落地进度  
> 最近更新：2026-01-28

## ✅ 已完成

### 1) Tauri 基础结构
- 新增 `src-tauri/Cargo.toml`、`src-tauri/build.rs`、`src-tauri/src/main.rs`
- 新增 `src-tauri/tauri.conf.json`
- Rust 启动 Sidecar 并解析 stdout 事件（`SIDECAR_PORT:*`、`EVENT:*`）
- 启动时注入 `TAURI_APP_DATA_DIR` 环境变量给 Sidecar

### 2) Sidecar 基础与 IPC 迁移
- 新增 `src/sidecar/server.ts` JSON-RPC 服务器
- 新增 `src/sidecar/index.ts` Sidecar 入口
- 新增 `src/sidecar/handlers.ts`，覆盖现有 IPC 能力：
  - `db:*`、`agent:*`、`env:*`（不含 dialog）
- 事件推送：Sidecar 写 stdout `EVENT:{channel,payload}` → Tauri emit → 前端监听

### 3) Renderer 适配
- 新增 `src/render/utils/tauri-bridge.ts`
- `src/render/index.tsx` 注入 `window.electron` 兼容层
- 所有 `dialog:*` 调用改为 `@tauri-apps/api/dialog`
- Node 运行时选择逻辑改用 Tauri `platform()` + `relaunch()`

### 4) Electron 清理
- 删除 `src/main/index.ts`、`src/main/preload.ts`、`src/main/ipc/*`
- `src/main/db/store.ts` 和 `src/main/utils/shell.ts` 改为使用 `getAppDataDir()`

### 5) 构建脚本与依赖
- `package.json` 更新为 Tauri 构建脚本
- 新增 `@tauri-apps/api`、`@tauri-apps/cli`、`esbuild`、`pkg`
- 移除 Electron 相关依赖与脚本
- `builder/rsbuild.render.ts` 去除 Electron main 进程启动

## ⏳ 待完成 / 风险项

### A) 文档更新
- `README.md`（Tauri 环境要求、构建说明）
- `AGENTS.md`（项目结构和命令）
- `CLAUDE.md`（如需）

### B) Sidecar 打包验证
- `pnpm run build:sidecar` → 确认 `SIDECAR_PORT:*` 输出
- `pkg` 打包后验证 `src-tauri/binaries/node-sidecar-*` 可执行
- 确认 `better-sqlite3` 打包是否需要 `pkg.assets` 配置
  - Release 配置使用 `src-tauri/tauri.release.conf.json`（含 `externalBin`）

### C) Tauri Dev/Build 验证
- `pnpm run dev`（使用 `src-tauri/tauri.dev.conf.json` + `TAURI_SIDECAR_JS`）
- 平台构建：`pnpm run build:darwin|build:win32|build:linux`

### D) 兼容性检查
- 前端 `process.platform` 已替换为 `@tauri-apps/api/os`
- 检查是否还有 Electron 依赖残留（`rg "electron" src`）

## 关键实现说明

### 事件通道（Sidecar → Tauri → Renderer）
- Sidecar 输出：
  - `SIDECAR_PORT:PORT`
  - `EVENT:{"channel":"agent:message","payload":{...}}`
- Rust 解析并 `emit_all` 对应事件
- Renderer 通过 `listen("agent:message")` 接收

### 数据目录
- Rust 启动 Sidecar 时注入 `TAURI_APP_DATA_DIR`
- Node 侧使用 `getAppDataDir()` 统一路径

## 下一步建议

1. 执行 `pnpm run dev` 验证侧车启动与基本功能  
2. 检查 `better-sqlite3` 打包策略是否需要 `pkg.assets`  
3. 补齐文档更新并做一次小范围测试  
