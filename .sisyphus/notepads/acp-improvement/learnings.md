# Learnings: ACP Implementation Research

## Date: 2026-01-27

## Search Strategy
- Used `grep_app_searchGitHub` with literal patterns
- Pattern variations: `session/cancel`, `$/cancel_request`, `terminal/*`, `fs/read`, `AcpFileSystemService`
- Cross-referenced with `gh search code` for specific repos

## Key Findings

### 1. session/cancel Implementation (✅ WELL-DOCUMENTED)
**Best Reference Repos:**
- `blowmage/cursor-agent-acp-npm` - Full ACP client with handler, tests, spec compliance
- `agentclientprotocol/typescript-sdk` - Official SDK with documentation
- `tiann/hapi` - Clean transport abstraction pattern
- `layercodedev/sled` - Complete payload construction with validation
- `shareAI-lab/Kode-cli` - Method registration pattern

**Key Pattern:**
```typescript
// Handler registration
this.peer.registerMethod('session/cancel', this.handleSessionCancel.bind(this))

// Transport send
this.transport.sendNotification('session/cancel', { sessionId })

// Notification payload (no id field)
{
  jsonrpc: "2.0",
  method: "session/cancel",
  params: { sessionId: this.sessionId }
}
```

**Critical Spec Details:**
- `session/cancel` is a **notification** (no response expected)
- Client should continue accepting tool call updates after cancel
- Agent must respond to original session/prompt with `CANCELLED` stop reason

### 2. $/cancel_request Implementation (⚠️ LSP CONTEXT ONLY)
**Found in LSP context, NOT ACP:**
- `angular/angular` - LSP language server cancel with request ID
- `microsoft/vscode` - MCP cancellation tokens with notification pattern

**Pattern (LSP, not ACP):**
```typescript
client.sendNotification('$/cancelRequest', {id: 1});
// Expects LSPErrorCodes.RequestCancelled
```

**Note:** This is NOT ACP-specific - it's standard LSP protocol. Different from `session/cancel`.

### 3. Terminal Methods (❌ NO IMPLEMENTATIONS FOUND)
- Searched: `terminal/createTerminal`, `terminal/sendInput`, `terminal/*`
- Result: Found `vandycknick/webtty` using `createTerminalMiddleware` but **not ACP-related**
- Conclusion: **No real-world ACP terminal implementations in public repos**

**Implication:** Terminal methods may be:
- Still experimental
- Implemented in private repos
- Not yet adopted by ACP ecosystem

### 4. FS Sandboxing (⚠️ SERVICE MODULES ONLY)
**Found service modules but no sandboxing logic visible:**
- `QwenLM/qwen-code` - `AcpFileSystemService` import
- `google-gemini/gemini-cli` - `AcpFileSystemService` import

**Missing:**
- Workspace root validation logic
- Path restriction patterns
- Sandboxing enforcement

**Next step needed:** Inspect actual `service/filesystem.js` files for sandbox implementation

## Best Practice Patterns Identified

### Method Registration (from shareAI-lab/Kode-cli)
```typescript
this.peer.registerMethod('session/cancel', 
    this.handleSessionCancel.bind(this))
```
- Use `.bind(this)` for proper context
- Consistent naming: `handleSessionCancel`

### Transport Abstraction (from tiann/hapi)
```typescript
async cancelPrompt(sessionId: string): Promise<void> {
    if (!this.transport) {
        return; // Graceful handling
    }
    this.transport.sendNotification('session/cancel', { sessionId });
}
```
- Null-check transport before sending
- Clean separation: `cancelPrompt` wrapper → `sendNotification`

### Complete Payload (from layercodedev/sled)
```typescript
cancelCurrentPrompt(): boolean {
    if (!this.sessionId) {
        return false; // Validation
    }
    const payload = {
        jsonrpc: "2.0",
        method: "session/cancel",
        params: { sessionId: this.sessionId },
    };
    try { /* ... */ }
}
```
- Return type indicates success/failure
- Full JSON-RPC 2.0 compliance
- Try-catch for error handling

### Spec Compliance (from agentclientprotocol/typescript-sdk)
```typescript
/**
 * Clients SHOULD continue accepting tool call updates even after
 * sending a `session/cancel` notification
 */
async sessionUpdate(params: schema.SessionNotification): Promise<void>
```
- Document critical edge cases
- Reference spec URL in comments
- Clear expectations

## Research Gaps

1. **Terminal Methods**: No implementations found → May need to rely on spec only
2. **FS Sandboxing**: Service modules found but implementation invisible → Need direct file inspection
3. **Integration Tests**: Limited test examples (only cursor-agent-acp-npm has good coverage)

## Recommended References

**Primary (session/cancel):**
1. `blowmage/cursor-agent-acp-npm` - Complete implementation
2. `agentclientprotocol/typescript-sdk` - Official SDK docs
3. `layercodedev/sled` - Payload construction pattern

**Secondary (cancel patterns):**
4. `tiann/hapi` - Transport abstraction
5. `shareAI-lab/Kode-cli` - Method registration

**LSP Context (for understanding only):**
6. `angular/angular` - LSP cancel request pattern
7. `microsoft/vscode` - MCP cancellation tokens

**Not Found (may need spec-only approach):**
- `terminal/*` implementations
- FS sandboxing enforcement logic
