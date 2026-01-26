```
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
```

## Open Claude Cowork - Development Guide

### Project Overview
Open Claude Cowork is a desktop application built with Electron and React that enables collaboration with AI agents using the Agent Client Protocol (ACP). It provides a rich chat interface with markdown support, task management, and plugin architecture for extending agent capabilities.

### Key Technologies
- **Runtime**: Electron (v39.2.6)
- **Frontend**: React (v19.2.1), TypeScript (v5.9.3)
- **Build Tool**: Rsbuild (v1.6.14)
- **Styling**: Tailwind CSS (v3.4.19)
- **Database**: better-sqlite3 (v12.6.2)
- **AI Communication**: @agentclientprotocol/sdk (v0.13.0)
- **Code Quality**: Biome (v2.3.8)

### Development Commands

#### Installation
```bash
pnpm install
```

#### Development
```bash
pnpm run dev          # Start dev mode (React + Electron with hot reload)
pnpm run dev:render   # Start only React renderer process
pnpm run dev:main     # Start only Electron main process (via nodemon)
```

#### Build
```bash
pnpm run build                    # Build for all platforms (interactive)
pnpm run build:darwin             # Build for macOS (ARM64 + x64 universal)
pnpm run build:mac-x64            # Build for macOS x64
pnpm run build:mac-arm64          # Build for macOS ARM64
pnpm run build:win32              # Build for Windows
pnpm run build:linux              # Build for Linux
pnpm run build:main               # Build only main process
pnpm run build:render             # Build only render process
pnpm run rebuild:main             # Build main process and run production version
```

#### Linting & Formatting
```bash
pnpm run lint                     # Run Biome linting and auto-fix
```

### Project Structure

```
open-claude-cowork/
├── src/
│   ├── main/                     # Electron main process
│   │   ├── acp/                  # Agent Client Protocol implementation
│   │   │   ├── AcpConnection.ts  # ACP connection manager
│   │   │   └── AcpDetector.ts    # ACP server discovery
│   │   ├── db/                   # SQLite database operations
│   │   ├── ipc/                  # Inter-process communication handlers
│   │   └── index.ts              # Application entry point
│   ├── render/                   # React renderer process
│   │   ├── agents/               # Agent plugin definitions & registry
│   │   ├── components/           # UI components (MessageRenderer, ChatInput, etc.)
│   │   ├── hooks/                # Custom React hooks
│   │   ├── utils/                # Utility functions (message composer, wallpaper)
│   │   ├── App.tsx / AppNew.tsx  # Main application components
│   │   └── index.tsx             # Renderer entry point
│   └── types/                    # Shared TypeScript type definitions
├── builder/                      # Rsbuild configuration files
├── public/                       # Static assets (icons, wallpapers)
└── package.json                  # Dependencies and scripts
```

### Architecture Overview

#### Main Process (Electron)
- **Responsibilities**: Window management, ACP server management, database operations, IPC communication
- **Key Files**:
  - `src/main/index.ts`: Application initialization and window creation
  - `src/main/acp/`: ACP connection and server discovery
  - `src/main/db/`: SQLite database schema and queries
  - `src/main/ipc/`: IPC handlers for communication with render process

#### Render Process (React)
- **Responsibilities**: UI rendering, user interaction, chat interface, task management
- **Key Files**:
  - `src/render/App.tsx` / `AppNew.tsx`: Main application layout and state management
  - `src/render/components/`: React components for chat, messages, sidebar, etc.
  - `src/render/agents/`: Agent plugin system and registry
  - `src/render/utils/messageTransformer.ts`: Message formatting and transformation

#### Communication Flow
1. User interacts with React UI
2. Render process sends IPC message to main process
3. Main process handles request (database, ACP, file operations)
4. Main process sends response back via IPC
5. Render process updates UI

### Key Features Implementation

#### AI Agent Integration (ACP)
- **File**: `src/main/acp/AcpConnection.ts`
- Uses @agentclientprotocol/sdk to communicate with AI agents
- Manages connection lifecycle and protocol negotiation
- Handles agent tool calls and responses

#### Task Management
- **Storage**: SQLite database (`src/main/db/`)
- **Components**: `src/render/components/Sidebar.tsx`
- Tasks are stored locally with their chat history and settings

#### Rich Chat Interface
- **Message Rendering**: `src/render/components/MessageRenderer.tsx`
- **Markdown Support**: react-markdown with remark-gfm
- **Code Highlighting**: react-syntax-highlighter
- **Tool Calls**: `src/render/components/MessageAcpToolCall.tsx`
- **Stop Button**: `src/render/components/SendBox.tsx` and `src/render/components/ThoughtDisplay.tsx`
  - Displayed when agent is processing a prompt
  - Click to cancel ongoing request
  - Uses ACP `session/cancel` notification
  - Agent responds with `StopReason::Cancelled`

### Configuration Files

- **tsconfig.json**: TypeScript configuration with path aliases (@src/, @main/, @render/, @components/)
- **biome.json**: Biome linter/formatter configuration
- **tailwind.config.ts**: Tailwind CSS configuration
- **builder/rsbuild.*.ts**: Rsbuild configuration for main and render processes

### Debugging Tips

- **Dev Tools**: Press Ctrl+Shift+I in the app to open Chrome DevTools
- **Main Process Logs**: View in terminal where `npm run dev:main` is running
- **Renderer Process Logs**: View in Chrome DevTools Console tab

### Code Quality Guidelines

- Use Biome for linting/formatting: `pnpm run lint`
- Follow existing TypeScript patterns
- Use React hooks for state management
- Components should be functional and stateless where possible
