# Tauri 2.0 升级完成

## 升级内容

成功将项目从 Tauri 1.x 升级到 Tauri 2.0，并修复了 sidecar 打包问题。

## 主要变更

### 1. 依赖升级

**NPM 包：**
- `@tauri-apps/cli`: 1.6.3 → 2.9.6
- `@tauri-apps/api`: 1.6.0 → 2.9.1
- 新增插件：
  - `@tauri-apps/plugin-dialog`: 2.6.0
  - `@tauri-apps/plugin-os`: 2.3.2
  - `@tauri-apps/plugin-process`: 2.3.1

**Rust 依赖：**
- `tauri`: 1.8.3 → 2.9.5
- `tauri-build`: 1.5.6 → 2.5.3
- 新增插件：
  - `tauri-plugin-shell`: 2.3.4
  - `tauri-plugin-http`: 2.5.6
  - `tauri-plugin-dialog`: 2.6.0

### 2. 配置文件更新

**Tauri 配置格式变更（v1 → v2）：**
- 添加 `$schema` 字段用于 IDE 支持
- `build.devPath` → `build.devUrl`
- `build.distDir` → `build.frontendDist`
- `package` 和 `tauri` 字段扁平化到根级别
- `tauri.allowlist` 移除（Tauri 2.0 使用插件系统）
- `tauri.bundle` → `bundle`
- `tauri.windows` → `app.windows`

### 3. Rust 代码更新

**主要 API 变更：**
- 导入 `tauri::Emitter` trait 以使用 `emit()` 方法
- `tauri::api::process` → `tauri_plugin_shell::process`
- `Command::new_sidecar()` → `shell.sidecar()`
- `app.path_resolver()` → `app.path()`
- `CommandEvent::Stdout/Stderr` 现在返回 `Vec<u8>` 而不是 `String`

### 4. 前端代码更新

**API 导入路径变更：**
- `@tauri-apps/api/dialog` → `@tauri-apps/plugin-dialog`
- `@tauri-apps/api/os` → `@tauri-apps/plugin-os`
- `@tauri-apps/api/process` → `@tauri-apps/plugin-process`
- `@tauri-apps/api/tauri` → `@tauri-apps/api/core`

### 5. Sidecar 打包修复

**问题：**
- Tauri 1.x 构建时不创建 bundle，导致 sidecar 无法正确打包
- Universal binary 需要 universal 版本的 sidecar

**解决方案：**
1. 升级到 Tauri 2.0（自动创建 bundle）
2. 为 macOS universal binary 创建 universal sidecar：
   ```bash
   lipo -create \
     src-tauri/binaries/node-sidecar-aarch64-apple-darwin \
     src-tauri/binaries/node-sidecar-x86_64-apple-darwin \
     -output src-tauri/binaries/node-sidecar-universal-apple-darwin
   ```
3. 更新 `package.json` 添加 `package:sidecar:darwin-universal` 脚本

## 构建产物

成功构建的文件：
- `Open Claude Cowork.app` - macOS 应用包（包含 sidecar）
- `Open Claude Cowork_0.2.0_universal.dmg` - macOS 安装镜像

Sidecar 位置：
```
Open Claude Cowork.app/Contents/MacOS/node-sidecar (117MB universal binary)
```

## 构建命令

```bash
# macOS universal binary (ARM64 + x64)
pnpm run build:darwin

# Windows x64
pnpm run build:win32

# Linux x64
pnpm run build:linux
```

## 验证

构建成功，sidecar 已正确打包到应用中：
```bash
$ ls -lh "src-tauri/target/universal-apple-darwin/release/bundle/macos/Open Claude Cowork.app/Contents/MacOS/"
-rwxr-xr-x  117M node-sidecar
-rwxr-xr-x   27M open-claude-cowork
```

## 注意事项

1. **开发模式**：仍然使用 Node.js 运行 `node-sidecar.js`
2. **生产模式**：使用打包的二进制 sidecar
3. **Universal binary**：需要同时构建 ARM64 和 x64 版本，然后合并
4. **插件系统**：Tauri 2.0 使用插件而不是 allowlist 来管理权限

## 相关文件

- `src-tauri/Cargo.toml` - Rust 依赖
- `src-tauri/src/main.rs` - 主进程代码
- `src-tauri/tauri.conf.json` - Tauri 配置
- `src-tauri/tauri.release.conf.json` - 生产构建配置
- `src-tauri/tauri.dev.conf.json` - 开发配置
- `package.json` - NPM 依赖和构建脚本
- `scripts/verify-sidecar.sh` - Sidecar 验证脚本
