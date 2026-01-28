# Repository Guidelines

## Project Structure & Module Organization

This is an **Electron + React + TypeScript** desktop app.

- `src/main/`: Electron “main” process (ACP client, SQLite, IPC, filesystem/runtime helpers).
- `src/render/`: React “renderer” UI (components, hooks, state, agent presets/icons).
- `src/types/`: Shared TypeScript types.
- `builder/`: Rsbuild configs for `main` and `render`.
- `public/` and `assets/`: Static assets (icons/wallpapers, etc.).
- `env/`: Build/runtime env templates (per-platform `.env.*`).

Notes:
- `release/` is generated output and is git-ignored (see `.gitignore`).

## Build, Test, and Development Commands

Use `pnpm` (see `package.json#packageManager`).

- `pnpm install`: Install deps (runs Electron postinstall + native deps setup).
- `pnpm run dev`: Local dev (uses `plop` to orchestrate main + renderer).
- `pnpm run dev:render`: Start only the renderer dev server.
- `pnpm run dev:main`: Start only the main process (via `nodemon.json`).
- `pnpm run lint`: Run Biome checks + auto-fix for `src/`.
- `pnpm run build`: Production build (interactive platform selection).
- `pnpm run build:darwin|build:win32|build:linux`: Platform-specific builds.
- `pnpm run rebuild:main`: Build main process and launch Electron using `release/dist/main/index.js`.

## Coding Style & Naming Conventions

- Indentation: **2 spaces**, line width **100** (Biome: `biome.json`).
- Quotes: **double quotes** (Biome JS/TS formatter).
- TypeScript: `strict: true` (`tsconfig.json`), prefer explicit types at boundaries.
- Paths: use aliases where appropriate (`@main/*`, `@render/*`, `@components/*`, etc.).

## Testing Guidelines

There is **no repository-level test runner wired** (no `test` script/config). Changes should include a quick manual check:

- Run `pnpm run dev` and exercise the relevant UI/IPC/agent flow.
- For build-related changes, verify with a platform build script (e.g. `pnpm run build:darwin`).

## Commit & Pull Request Guidelines

Commits generally follow **Conventional Commits** style (examples in history): `feat:`, `fix:`, `refactor:`, `chore:`, `style:`, `release:`.

PRs should include:
- What changed + why, and how to test locally (`pnpm run dev`, build script if relevant).
- Screenshots/screen recording for UI changes.
- Platform notes if behavior differs (macOS/Windows/Linux).
- Ensure `pnpm run lint` passes before requesting review.
