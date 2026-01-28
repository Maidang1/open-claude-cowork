import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

type Listener = (...args: unknown[]) => void;

class TauriBridge {
  private sidecarPort: number | null = null;
  private readyPromise: Promise<void>;
  private eventListeners = new Map<string, Set<Listener>>();
  private unlistenFns: UnlistenFn[] = [];
  private lastSidecarError: string | null = null;
  private lastSidecarStdout: string | null = null;
  private initError: Error | null = null;

  constructor() {
    this.readyPromise = this.initialize().catch((err) => {
      this.initError = err instanceof Error ? err : new Error(String(err));
    });
  }

  private async initialize() {
    const unlistenReady = await listen<number>("sidecar:ready", (event) => {
      this.sidecarPort = event.payload;
      this.emit("sidecar:ready", event.payload);
    });
    this.unlistenFns.push(unlistenReady);

    const unlistenAgent = await listen<any>("agent:message", (event) => {
      this.emit("agent:message", event.payload);
    });
    this.unlistenFns.push(unlistenAgent);

    const unlistenStderr = await listen<string>("sidecar:stderr", (event) => {
      this.lastSidecarError = event.payload;
      console.warn("[sidecar:stderr]", event.payload);
    });
    this.unlistenFns.push(unlistenStderr);

    const unlistenStdout = await listen<string>("sidecar:stdout", (event) => {
      this.lastSidecarStdout = event.payload;
      console.info("[sidecar:stdout]", event.payload);
    });
    this.unlistenFns.push(unlistenStdout);

    try {
      const port = await invoke<number>("get_sidecar_port");
      if (port) {
        this.sidecarPort = port;
      }
    } catch {
      // Ignore if sidecar not ready yet
    }

    const maxWait = 10000;
    const startTime = Date.now();
    while (!this.sidecarPort && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async ensureReady(timeoutMs = 30000) {
    await this.readyPromise;
    if (this.sidecarPort) return;

    const startTime = Date.now();
    while (!this.sidecarPort && Date.now() - startTime < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (!this.sidecarPort) {
      const detail =
        this.lastSidecarError ||
        this.lastSidecarStdout ||
        this.initError?.message ||
        "unknown";
      throw new Error(`Sidecar failed to start within ${timeoutMs / 1000}s: ${detail}`);
    }
  }

  async invoke(method: string, ...args: unknown[]): Promise<any> {
    await this.ensureReady();

    const response = await fetch(`http://localhost:${this.sidecarPort}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params: args.length === 1 ? args[0] : args,
        id: Date.now(),
      }),
    });

    const raw = await response.text();
    if (!raw) {
      throw new Error(`RPC empty response (${response.status})`);
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      throw new Error(`RPC invalid JSON (${response.status}): ${raw}`);
    }

    if (data?.error) {
      const detail =
        data.error?.data
          ? ` | ${typeof data.error.data === "string" ? data.error.data : JSON.stringify(data.error.data)}`
          : "";
      throw new Error(`${data.error.message || "RPC Error"}${detail}`);
    }

    return data?.result;
  }

  on(channel: string, listener: Listener): () => void {
    if (!this.eventListeners.has(channel)) {
      this.eventListeners.set(channel, new Set());
    }
    this.eventListeners.get(channel)!.add(listener);

    return () => {
      const listeners = this.eventListeners.get(channel);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  async send(channel: string, ..._args: unknown[]) {
    console.warn(`[TauriBridge] send() is deprecated for ${channel}, use invoke() instead`);
  }

  cleanup() {
    this.unlistenFns.forEach((fn) => fn());
    this.eventListeners.clear();
  }

  private emit(channel: string, ...args: unknown[]) {
    const listeners = this.eventListeners.get(channel);
    if (listeners) {
      listeners.forEach((listener) => listener(...args));
    }
  }
}

export const tauriBridge = new TauriBridge();
