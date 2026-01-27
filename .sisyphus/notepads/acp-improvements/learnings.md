# Learnings

## 2026-01-27
- Keep ACP docs aligned with repo implementation; document deviations explicitly.
- Prefer spec-aligned extension points: `_meta` for extra fields; `_`-prefixed method names for extension methods.
- In this repo, ACP integration spans main process ACP client (src/main/acp/*) and IPC glue (src/main/ipc/agent.ts).
- `lsp_diagnostics` may not always align with `pnpm run lint` results, especially for parse errors that might be caught by different configurations or tools. It's important to cross-reference with actual build/lint commands.
- The task successfully created a detailed ACP implementation improvement document, highlighting security, compliance, UX, reliability, observability, and maintainability concerns.
- Evidence snippets in docs must be <=15 lines per code fence; split into labeled fragments if more context is needed.

## Biome Parser Research (2026-01-27)

### Parser Error Patterns
Biome parser has known issues with "Expected an expression but instead found '}'" type errors. This pattern indicates the parser expected to parse an expression but encountered a closing brace/parenthesis instead.

**Known Issues from Biome GitHub:**
- Issue #4317: Trailing commas after get accessors cause parsing problems
- Issue #6537: Biome 2 incorrectly removes trailing commas from JSONC files (confirmed bug)
- Issue #1077: Parenthesized identifiers in ternaries incorrectly parsed as arrow functions
- Issue #4765: `export { type default as CrsMeta }` causes "expected `,` but instead found `default`"

### Trailing Commas in Biome
Biome has explicit configuration for trailing commas in JSON:
```json
{
  "json": {
    "parser": {
      "allowTrailingCommas": true
    }
  }
}
```

However, JS/TS trailing comma handling is more complex and context-dependent.

### Multi-line Function Call Pattern Analysis
For patterns like `ipcMain.handle(channel, handler);` where handler is a multi-line callback:

**Correct Pattern:**
```typescript
ipcMain.handle("channel", async () => {
  const result = await doSomething();
  return result;
});
```

**Potential Issue Pattern:**
```typescript
ipcMain.handle("channel", async () => {
  const result = await doSomething(),
  return result,
}); // Biome may struggle with the comma + closing brace combo
```

The closing `});` creates ambiguity:
- `)` closes the async arrow function parameters
- `}` closes the arrow function body  
- `)` closes the outer `ipcMain.handle()` call

### Key Gotchas
1. **Parenthesized identifiers** in certain contexts (ternaries, arrow functions) can cause parser confusion
2. **Trailing commas** before closing braces in multi-line callbacks can trigger parse errors
3. **Context-sensitive parsing**: The same syntax may parse correctly in one context but not another
4. **Parser recovery**: Biome attempts to recover from parse errors, but recovery may not always produce expected results

### Recommended Avoidance Strategy
For multi-line IPC handlers, avoid trailing commas before closing braces:
```typescript
// ✅ Preferred
ipcMain.handle("channel", async (event, ...args) => {
  const data = await process(args);
  return data;
});

// ❌ Avoid (trailing comma before closing brace)
ipcMain.handle("channel", async (event, ...args) => {
  const data = await process(args),
  return data,
});
```

### Sources
- Biome GitHub Issues: https://github.com/biomejs/biome/issues/4317, /issues/1077, /issues/4765
- Biome Docs: https://biomejs.dev/
- Biome Changelog: https://github.com/biomejs/biome/blob/main/CHANGELOG_v1.md
