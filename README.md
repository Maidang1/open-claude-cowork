# Open Claude Cowork

Open Claude Cowork is a powerful desktop application built with Electron and React designed to facilitate collaboration with AI agents. It leverages the Agent Client Protocol (ACP) to provide a seamless interface for interacting with various AI models and agents, managing tasks, and executing complex workflows.

## Features

<div align="center">
  <img src="https://github.com/user-attachments/assets/81414418-4a94-4d8e-9087-47125368a5c4" alt="Dark Mode" width="100%" />
  <br/><br/>
  <img src="https://github.com/user-attachments/assets/5c33a246-17b5-4b47-ad30-3164a2753a06" alt="Light Mode" width="100%" />
  <br/><br/>
  <img src="https://github.com/user-attachments/assets/19f07850-25e2-4752-b88a-d51e7047f3b6" alt="Model Selection" width="100%" />
</div>

- **🤖 AI Agent Integration**: Connect and interact with AI agents (e.g., Qwen) using the standardized Agent Client Protocol (ACP).
- **📋 Task Management**: Organize your work into distinct tasks, each with its own workspace context and agent configuration.
- **💬 Rich Chat Interface**:
  - Markdown support with syntax highlighting.
  - Visibility into agent thought processes.
  - Real-time tool call status and logs.
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
