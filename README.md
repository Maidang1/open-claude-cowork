# Open Claude Cowork

Open Claude Cowork is an Electron + React desktop app for working with local AI agent CLIs via the **Agent Client Protocol (ACP)**, with optional **Model Context Protocol (MCP)** server integration for tools/data sources.

## Features

> Notes
> - Agents run locally (as CLI processes). This app is an ACP client UI.
> - Task data is stored locally (SQLite) under the app’s user data directory.

<p align="left">
  <img width="400" alt="screenshot-20260126-001" src="https://github.com/user-attachments/assets/38a09ed6-e654-434d-8aa0-2d2e68bb0250" />
  <img width="400" alt="screenshot-20260126-002" src="https://github.com/user-attachments/assets/ee6096ec-bd14-4c9c-9a78-6eed9d096093" />
</p>
<p align="left">
  <img width="400" alt="screenshot-20260126-005" src="https://github.com/user-attachments/assets/3399660f-1bf1-4d74-8e67-b72eccc3be55" />
  <img width="400" alt="screenshot-20260126-006" src="https://github.com/user-attachments/assets/1598669e-0340-41b4-8184-e4f360d640c2" />
</p>
<p align="left">
  <img width="400" alt="screenshot-20260126-004" src="https://github.com/user-attachments/assets/62ec5dd3-385b-4026-be15-1d6227accf40" />
  <img width="400" alt="screenshot-20260126-003" src="https://github.com/user-attachments/assets/294788f2-0575-4879-8886-ff85f0919fc6" />
</p>


- **ACP agent support (local CLIs)**: Qwen / Claude / Codex / Gemini / OpenCode (via ACP).
- **Per-task workspaces**: Each task keeps its own workspace folder, agent command, env vars, model selection, and session id.
- **MCP servers (per task)**: Configure MCP servers and transport (`stdio`, `http`, `sse`) and pass them to the agent during session setup.
- **Chat UI for agent streams**: Markdown + code highlighting, tool call updates, logs, and permission prompts.
- **Attachments & rendering**: Image attachments and diff rendering for patches/changes.
- **Personalization**: Light/dark/auto theme + configurable wallpaper (presets or custom).
- **Local-first storage**: SQLite DB (tasks + settings) stored locally.

## Tech Stack

- **Runtime**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Ant Design](https://ant.design/), Tailwind CSS
- **Build Tool**: [Rsbuild](https://rsbuild.dev/)
- **Styling / UI**: CSS, [Lucide React](https://lucide.dev/), [@lobehub/icons](https://github.com/lobehub/lobe-icons), [react-virtuoso](https://virtuoso.dev/) (virtualized list)
- **Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Protocols**: [@agentclientprotocol/sdk](https://www.npmjs.com/package/@agentclientprotocol/sdk) (ACP), [Model Context Protocol](https://modelcontextprotocol.io/) (MCP)

## Supported Agents (ACP)

This repo includes built-in agent presets (see `src/types/acpTypes.ts`):

- **Qwen Agent** (`@qwen-code/qwen-code`) — default command: `qwen --acp ...`
- **Claude Agent** (`@zed-industries/claude-code-acp`) — default command: `npx @zed-industries/claude-code-acp`
- **Codex Agent** (`@zed-industries/codex-acp`) — default command: `npx @zed-industries/codex-acp`
- **Gemini Agent** (`@google/gemini-code`) — default command: `gemini --acp ...`
- **OpenCode Agent** (`opencode-ai`) — default command: `opencode acp`

The app can install these packages into its own agents directory (`app.getPath("userData")/agents`) using **system `npm`** from the UI.

## Prerequisites

- **Node.js**: Version 18 or higher recommended.
- **pnpm** (recommended) or **npm**: Package manager (repo dev/build).

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/open-claude-cowork.git
   cd open-claude-cowork
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

## Development

To start the application in development mode with hot reloading:

```bash
pnpm run dev
```

This will launch:
- The React renderer process (Rsbuild dev server)
- The Electron main process (auto-started via `dev:main` / Nodemon)

To lint:

```bash
pnpm run lint
```

### Build for Production

To build the application for production:

```bash
pnpm run build
```

By default, `pnpm run build` will prompt for a platform. To build for a specific platform (no prompt):

```bash
pnpm run build:darwin
pnpm run build:mac-x64
pnpm run build:mac-arm64
pnpm run build:win32
pnpm run build:linux
```

You can also pass a platform flag or env var:

```bash
pnpm run build -- --build-platform=darwin
BUILD_PLATFORM=linux pnpm run build
```

To build and run the production build locally:

```bash
pnpm run rebuild:main
```

## MCP (Model Context Protocol)

You can configure MCP servers per task in Settings → Agents → MCP Servers. See:

- `docs/mcp-quick-start.md`
- `docs/mcp-ui-guide.md`
- `docs/mcp-examples.md`
- `docs/mcp-configuration.md`

## Project Structure

```
open-claude-cowork/
├── builder/             # Rsbuild configuration files
├── docs/                # MCP guides and internal notes
├── public/              # Static assets (icons, images)
├── src/
│   ├── main/            # Electron main process
│   │   ├── acp/         # ACP client implementation (spawn, session, streaming)
│   │   ├── db/          # Database schema and operations
│   │   ├── ipc/         # IPC handlers (agent/env/db/dialog)
│   │   ├── utils/       # Shell / runtime helpers
│   │   └── index.ts     # Main entry
│   ├── render/          # React renderer process
│   │   ├── agents/      # Agent registry + icons
│   │   ├── components/  # UI components
│   │   └── App.tsx      # Main app
│   └── types/           # Shared types (ACP/MCP/etc.)
├── package.json         # Dependencies and scripts
└── README.md            # Project documentation
```

## License

[MIT](LICENSE)
