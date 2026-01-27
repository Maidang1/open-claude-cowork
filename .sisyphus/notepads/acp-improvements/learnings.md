# Learnings

## 2026-01-27
- Keep ACP docs aligned with repo implementation; document deviations explicitly.
- Prefer spec-aligned extension points: `_meta` for extra fields; `_`-prefixed method names for extension methods.
- In this repo, ACP integration spans main process ACP client (src/main/acp/*) and IPC glue (src/main/ipc/agent.ts).
- `lsp_diagnostics` may not always align with `pnpm run lint` results, especially for parse errors that might be caught by different configurations or tools. It's important to cross-reference with actual build/lint commands.
- The task successfully created a detailed ACP implementation improvement document, highlighting security, compliance, UX, reliability, observability, and maintainability concerns.
