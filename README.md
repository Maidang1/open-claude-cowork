# Open Claude Cowork

Open Claude Cowork is a powerful desktop application built with Electron and React designed to facilitate collaboration with AI agents. It leverages the Agent Client Protocol (ACP) to provide a seamless interface for interacting with various AI models and agents, managing tasks, and executing complex workflows.

## Features






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


- **🤖 AI Agent Integration**: Connect and interact with AI agents (e.g., Qwen) using the standardized Agent Client Protocol (ACP).
- **📋 Task Management**: Organize your work into distinct tasks, each with its own workspace context and agent configuration.
- **💬 Rich Chat Interface**:
  - Markdown support with syntax highlighting.
  - Visibility into agent thought processes.
  - Real-time tool call status and logs.
  - Stop button to cancel ongoing prompt requests.
- **🔌 Plugin Architecture**: Extensible design allowing easy addition of new agent types via a plugin system.
- **💾 Local Persistence**: All tasks and settings are stored locally using SQLite for privacy and offline access.
- **🌗 Dark/Light Mode**: Built-in support for both dark and light themes.
- **🖥️ Cross-Platform**: Built on Electron, compatible with macOS, Windows, and Linux.

## Tech Stack

- **Runtime**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Rsbuild](https://rsbuild.dev/)
- **Styling**: CSS, [Lucide React](https://lucide.dev/) (Icons)
- **Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Communication**: [@agentclientprotocol/sdk](https://www.npmjs.com/package/@agentclientprotocol/sdk)

## Prerequisites

- **Node.js**: Version 18 or higher recommended.
- **pnpm** (preferred) or **npm**: Package manager.

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/open-claude-cowork.git
   cd open-claude-cowork
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

## Development

To start the application in development mode with hot reloading:

```bash
npm run dev
```

This will launch:
- The React renderer process (via Rsbuild)
- The Electron main process (via Nodemon)

### Build for Production

To build the application for production:

```bash
npm run build
```

To build for a specific platform (no prompt):

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
npm run rebuild:main
```

## Project Structure

```
open-claude-cowork/
├── builder/             # Rsbuild configuration files
├── public/              # Static assets (icons, images)
├── src/
│   ├── main/            # Electron main process
│   │   ├── acp/         # Agent Client Protocol client implementation
│   │   ├── db/          # Database schema and operations
│   │   └── index.ts     # Application entry point
│   └── render/          # React renderer process
│       ├── agents/      # Agent plugin definitions
│       ├── App.tsx      # Main application component
│       └── components/  # UI components
├── package.json         # Dependencies and scripts
└── README.md            # Project documentation
```

## License

[MIT](LICENSE)
