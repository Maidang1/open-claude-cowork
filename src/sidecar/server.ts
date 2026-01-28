import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id: string | number;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id: string | number | null;
};

export type RpcHandler = (params: unknown) => Promise<unknown>;

export class JsonRpcServer {
  private server: Server;
  private handlers = new Map<string, RpcHandler>();

  constructor() {
    this.server = createServer(this.handleRequest.bind(this));
  }

  register(method: string, handler: RpcHandler) {
    this.handlers.set(method, handler);
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body) as Partial<JsonRpcRequest> | null;
        const request = parsed && typeof parsed === "object" ? parsed : null;
        const id = typeof request?.id !== "undefined" ? request.id : null;
        const method = request?.method;

        if (!method) {
          const response: JsonRpcResponse = {
            jsonrpc: "2.0",
            error: { code: -32600, message: "Invalid Request" },
            id,
          };
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
          return;
        }

        const handler = this.handlers.get(method);

        if (!handler) {
          const response: JsonRpcResponse = {
            jsonrpc: "2.0",
            error: { code: -32601, message: `Method not found: ${method}` },
            id,
          };
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
          return;
        }

        const result = await handler(request?.params);
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          result,
          id,
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (error: any) {
        console.error("[Sidecar] RPC error:", error);
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error?.message || "Internal error",
            data: error?.stack,
          },
          id: null,
        };
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      }
    });
  }

  listen(port: number = 0): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        const address = this.server.address();
        const actualPort = typeof address === "object" ? address?.port || 0 : 0;
        resolve(actualPort);
      });
    });
  }

  close() {
    this.server.close();
  }
}
