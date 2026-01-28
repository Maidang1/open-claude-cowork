import type { McpServerConfig } from "@src/types/mcpTypes";

/**
 * Convert MCP server configurations to the format expected by ACP protocol
 * Only includes enabled servers
 */
export const convertMcpServersForAcp = (servers: McpServerConfig[] = []) => {
  return servers
    .filter((server) => server.enabled)
    .map((server) => {
      if (server.transport.type === "stdio") {
        // Convert env object to array of {name, value} pairs
        const envArray = Object.entries(server.transport.env || {}).map(([name, value]) => ({
          name,
          value,
        }));

        return {
          name: server.name,
          command: server.transport.command,
          args: server.transport.args || [],
          env: envArray,
        };
      }

      if (server.transport.type === "http") {
        // Convert headers object to array of {name, value} pairs
        const headersArray = Object.entries(server.transport.headers || {}).map(([name, value]) => ({
          name,
          value,
        }));

        return {
          type: "http" as const,
          name: server.name,
          url: server.transport.url,
          headers: headersArray,
        };
      }

      if (server.transport.type === "sse") {
        // Convert headers object to array of {name, value} pairs
        const headersArray = Object.entries(server.transport.headers || {}).map(([name, value]) => ({
          name,
          value,
        }));

        return {
          type: "sse" as const,
          name: server.name,
          url: server.transport.url,
          headers: headersArray,
        };
      }

      return null;
    })
    .filter(Boolean);
};
