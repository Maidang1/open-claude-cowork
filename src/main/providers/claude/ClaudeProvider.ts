import type {
  AgentProvider,
  AgentProviderConfig,
  ClaudeSdkProviderPayload,
  ProviderMessageHandler,
} from "../base/AgentProvider";
import { ClaudeSdkAdapter } from "./ClaudeSdkAdapter";

export class ClaudeProvider implements AgentProvider {
  type: AgentProvider["type"] = "claude-sdk";
  private onMessage: ProviderMessageHandler;
  private adapter = new ClaudeSdkAdapter();
  private client: any | null = null;
  private connected = false;
  private abortController: AbortController | null = null;
  private pendingPermissions = new Map<string, (response: any) => void>();
  private config: ClaudeSdkProviderPayload | null = null;

  constructor(onMessage: ProviderMessageHandler) {
    this.onMessage = onMessage;
  }

  async connect(
    config: AgentProviderConfig,
    _options?: { reuseIfSame?: boolean; createSession?: boolean },
  ) {
    if (config.type !== "claude-sdk") {
      throw new Error("Invalid config type for ClaudeProvider");
    }
    this.config = config.payload;
    await this.ensureClient();
    this.connected = true;
    this.onMessage({ type: "system", text: "System: Claude SDK connected." });
    return { sessionId: null };
  }

  async disconnect() {
    this.abortController?.abort();
    this.abortController = null;
    this.client = null;
    this.connected = false;
    this.pendingPermissions.clear();
  }

  async sendMessage(text: string, images?: Array<{ mimeType: string; dataUrl: string }>) {
    if (!this.connected) {
      throw new Error("Claude SDK not connected");
    }
    await this.ensureClient();
    if (!this.client) {
      throw new Error("Claude SDK client unavailable");
    }

    const payload = this.buildQueryPayload(text, images);
    this.abortController = new AbortController();
    this.adapter.resetStream();

    const stream = await this.invokeQuery(payload, this.abortController.signal);
    for await (const event of stream) {
      const messages = this.adapter.handleSdkMessage(event);
      for (const msg of messages) {
        this.onMessage(msg);
      }
    }
  }

  async stopCurrentRequest() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  resolvePermission(id: string, response: any) {
    const resolver = this.pendingPermissions.get(id);
    if (resolver) {
      resolver(response);
      this.pendingPermissions.delete(id);
    } else {
      this.onMessage({ type: "system", text: `System: No pending permission for id ${id}.` });
    }
  }

  private async ensureClient() {
    if (this.client) return;
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    const createClient =
      (sdk as any).createClient ??
      (sdk as any).default?.createClient ??
      (sdk as any).ClaudeAgent ??
      (sdk as any).createClaudeAgent;
    if (!createClient) {
      throw new Error("Claude SDK createClient not found");
    }
    this.client = await createClient({
      apiKey: this.config?.apiKey,
      baseUrl: this.config?.baseUrl,
    });
  }

  private buildQueryPayload(text: string, images?: Array<{ mimeType: string; dataUrl: string }>) {
    const options = { ...(this.config?.options ?? {}) };
    const payload: Record<string, any> = {
      model: this.config?.model,
      input: text,
      options,
    };

    if (images && images.length > 0) {
      payload.images = images.map((image) => ({
        mimeType: image.mimeType,
        data: image.dataUrl,
      }));
    }

    if (!options.permissionMode) {
      options.permissionMode = "ask";
    }

    if (!options.canUseTool) {
      options.canUseTool = async (tool: any) => {
        if (options.permissionMode === "bypassPermissions") return true;
        const response = await this.requestPermission(tool);
        const outcome = response?.outcome?.outcome;
        const optionId = response?.outcome?.optionId;
        if (outcome === "selected") {
          return optionId !== "deny";
        }
        return false;
      };
    }

    return payload;
  }

  private async invokeQuery(payload: Record<string, any>, signal: AbortSignal) {
    const queryFn =
      this.client?.query ??
      this.client?.messages?.query ??
      this.client?.createMessage ??
      this.client?.messages?.create;
    if (!queryFn) {
      throw new Error("Claude SDK query method not found");
    }
    return await queryFn.call(this.client, { ...payload, signal });
  }

  private async requestPermission(tool: any) {
    const permissionId = Math.random().toString(36).slice(2);
    this.onMessage({
      type: "permission_request",
      id: permissionId,
      tool: tool?.name || tool?.title || "Unknown Tool",
      content: tool?.description || "Tool request",
      options: [
        { optionId: "allow", label: "Allow" },
        { optionId: "deny", label: "Deny" },
      ],
    });
    return new Promise((resolve) => {
      this.pendingPermissions.set(permissionId, resolve);
    });
  }
}
