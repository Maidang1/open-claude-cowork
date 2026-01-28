// MCP Server Configuration Types based on ACP Protocol
// Reference: https://agentclientprotocol.com/protocol/session-setup#mcp-servers

export type McpTransportType = "stdio" | "http" | "sse";

export interface McpStdioTransport {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpHttpTransport {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}

export interface McpSseTransport {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

export type McpTransport = McpStdioTransport | McpHttpTransport | McpSseTransport;

export interface McpServerConfig {
  id: string; // Unique identifier for the server
  name: string; // Display name
  description?: string;
  transport: McpTransport;
  enabled: boolean;
}

export interface McpCapabilities {
  http?: boolean;
  sse?: boolean;
}
