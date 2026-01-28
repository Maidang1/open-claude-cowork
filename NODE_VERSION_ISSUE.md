# Node.js Version Compatibility Issue

## Problem

The app is failing to start with the error:
```
Error: Sidecar failed to start within 30s: unknown
```

This is caused by `better-sqlite3` (a native Node.js module) being incompatible with Node.js v25.

## Root Cause

- You're currently using **Node.js v25.4.0** (very new, released January 2025)
- `better-sqlite3@12.6.2` doesn't support Node.js v25 yet
- The native module fails to compile with error: `NODE_MODULE_VERSION 141`

## Solution

### Option 1: Switch to Node.js LTS (Recommended)

Use Node.js v20 LTS, which is stable and fully supported:

```bash
# If using nvm
nvm install 20
nvm use 20

# If using fnm
fnm install 20
fnm use 20

# Verify version
node --version  # Should show v20.x.x

# Reinstall dependencies
pnpm install

# Rebuild native modules
pnpm rebuild better-sqlite3

# Build sidecar
pnpm run build:sidecar

# Start the app
pnpm run dev
```

### Option 2: Use Node.js v22 LTS

```bash
nvm use 22  # or fnm use 22
pnpm install
pnpm rebuild better-sqlite3
pnpm run build:sidecar
pnpm run dev
```

### Option 3: Wait for better-sqlite3 Update

Monitor the [better-sqlite3 repository](https://github.com/WiseLibs/better-sqlite3) for Node.js v25 support.

## Verification

After switching Node.js versions, verify the sidecar works:

```bash
# Build the sidecar
pnpm run build:sidecar

# Test it directly
node src-tauri/binaries/node-sidecar.js
```

You should see:
```
[DB] Initializing database at /path/to/app.db
SIDECAR_PORT:xxxxx
[Sidecar] Server started on port xxxxx
```

## Why This Happened

Node.js v25 is a **Current** release (not LTS), which means:
- It's cutting-edge but less stable
- Native modules may not support it yet
- It's recommended for testing, not production

The project requires Node.js 18+ (as stated in the migration plan), but **LTS versions (v20 or v22) are strongly recommended** for compatibility with native dependencies.

## Prevention

A `.nvmrc` file has been added to the project root specifying Node.js v20.18.1. When you run `nvm use` or `fnm use`, it will automatically switch to the correct version.
