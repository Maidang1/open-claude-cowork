import { Check, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { McpServerConfig } from "@src/types/mcpTypes";

interface McpSettingsProps {
  mcpServers: McpServerConfig[];
  onMcpServersChange: (servers: McpServerConfig[]) => void;
  mcpCapabilities?: { http?: boolean; sse?: boolean };
}

const DEFAULT_JSON_EXAMPLE = `{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/directory"
      ]
    }
  }
}`;

const McpSettings: React.FC<McpSettingsProps> = ({
  mcpServers,
  onMcpServersChange,
  mcpCapabilities,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Convert internal format to standard MCP JSON format
  const serversToJson = (servers: McpServerConfig[]): string => {
    const mcpServersObj: Record<string, any> = {};
    
    servers.forEach((server) => {
      if (server.transport.type === "stdio") {
        mcpServersObj[server.name] = {
          command: server.transport.command,
          args: server.transport.args || [],
        };
        
        // Add env if not empty
        if (server.transport.env && Object.keys(server.transport.env).length > 0) {
          mcpServersObj[server.name].env = server.transport.env;
        }
      } else if (server.transport.type === "http" || server.transport.type === "sse") {
        mcpServersObj[server.name] = {
          type: server.transport.type,
          url: server.transport.url,
        };
        
        // Add headers if not empty
        if (server.transport.headers && Object.keys(server.transport.headers).length > 0) {
          mcpServersObj[server.name].headers = server.transport.headers;
        }
      }
    });

    return JSON.stringify({ mcpServers: mcpServersObj }, null, 2);
  };

  // Parse standard MCP JSON format to internal format
  const jsonToServers = (json: string): McpServerConfig[] => {
    const parsed = JSON.parse(json);
    
    if (!parsed.mcpServers || typeof parsed.mcpServers !== "object") {
      throw new Error('JSON must contain "mcpServers" object');
    }

    const servers: McpServerConfig[] = [];
    
    Object.entries(parsed.mcpServers).forEach(([name, config]: [string, any]) => {
      if (!config || typeof config !== "object") {
        throw new Error(`Invalid configuration for server "${name}"`);
      }

      // Determine transport type
      if (config.type === "http" || config.type === "sse") {
        if (!config.url) {
          throw new Error(`Server "${name}" is missing required "url" field`);
        }
        
        servers.push({
          id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name,
          transport: {
            type: config.type,
            url: config.url,
            headers: config.headers || {},
          },
          enabled: true,
        });
      } else {
        // Default to stdio
        if (!config.command) {
          throw new Error(`Server "${name}" is missing required "command" field`);
        }
        
        if (!Array.isArray(config.args)) {
          throw new Error(`Server "${name}" "args" must be an array`);
        }
        
        servers.push({
          id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name,
          transport: {
            type: "stdio",
            command: config.command,
            args: config.args,
            env: config.env || {},
          },
          enabled: true,
        });
      }
    });

    return servers;
  };

  const handleEdit = () => {
    setJsonText(serversToJson(mcpServers));
    setJsonError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setJsonText("");
    setJsonError(null);
  };

  const handleSave = () => {
    try {
      const servers = jsonToServers(jsonText);
      onMcpServersChange(servers);
      setIsEditing(false);
      setJsonText("");
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const handleToggleEnabled = (id: string) => {
    onMcpServersChange(
      mcpServers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <div className="modal-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label className="modal-label">MCP Servers Configuration</label>
        {!isEditing && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleEdit}
            style={{ padding: "6px 12px", fontSize: "0.875rem" }}
          >
            Edit JSON
          </button>
        )}
      </div>

      <span className="modal-input-hint" style={{ marginTop: "6px" }}>
        Configure Model Context Protocol (MCP) servers using standard JSON format.
        {mcpCapabilities && (
          <div style={{ marginTop: "4px" }}>
            Supported transports: stdio
            {mcpCapabilities.http && ", http"}
            {mcpCapabilities.sse && ", sse"}
          </div>
        )}
      </span>

      {/* Server List */}
      {!isEditing && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {mcpServers.length === 0 ? (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "var(--text-secondary)",
                border: "1px dashed var(--border)",
                borderRadius: "8px",
              }}
            >
              No MCP servers configured. Click "Edit JSON" to add servers.
            </div>
          ) : (
            mcpServers.map((server) => (
              <div
                key={server.id}
                style={{
                  padding: "12px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: server.enabled ? 1 : 0.6,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                    {server.name}
                    <span
                      style={{
                        marginLeft: "8px",
                        fontSize: "0.75rem",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "var(--surface-hover)",
                      }}
                    >
                      {server.transport.type}
                    </span>
                  </div>
                  {server.description && (
                    <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      {server.description}
                    </div>
                  )}
                  <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    {server.transport.type === "stdio" && (
                      <>
                        <div>Command: {server.transport.command}</div>
                        <div>Args: {JSON.stringify(server.transport.args)}</div>
                      </>
                    )}
                    {(server.transport.type === "http" || server.transport.type === "sse") &&
                      `URL: ${server.transport.url}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={server.enabled}
                      onChange={() => handleToggleEnabled(server.id)}
                    />
                    <span style={{ fontSize: "0.875rem" }}>Enabled</span>
                  </label>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* JSON Editor */}
      {isEditing && (
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            backgroundColor: "var(--surface-hover)",
          }}
        >
          <h3 style={{ marginBottom: "8px", fontSize: "1rem", fontWeight: 600 }}>
            Edit MCP Configuration
          </h3>
          
          <span className="modal-input-hint" style={{ display: "block", marginBottom: "12px" }}>
            Paste your MCP configuration in standard JSON format. Example:
          </span>

          <textarea
            className="modal-input"
            rows={16}
            placeholder={DEFAULT_JSON_EXAMPLE}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setJsonError(null);
            }}
            style={{
              fontFamily: "monospace",
              fontSize: "0.875rem",
              lineHeight: "1.5",
            }}
          />

          {jsonError && (
            <div
              style={{
                marginTop: "8px",
                padding: "8px 12px",
                backgroundColor: "var(--error-bg, #fee)",
                color: "var(--error, #c00)",
                borderRadius: "4px",
                fontSize: "0.875rem",
              }}
            >
              ❌ {jsonError}
            </div>
          )}

          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              backgroundColor: "var(--surface)",
              borderRadius: "4px",
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "8px" }}>💡 Common Examples:</div>
            <div style={{ fontFamily: "monospace", fontSize: "0.8rem", lineHeight: "1.6" }}>
              <div>• Chrome DevTools: "command": "npx", "args": ["-y", "chrome-devtools-mcp@latest"]</div>
              <div>• Filesystem: "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]</div>
              <div>• GitHub: "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"]</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              <X size={16} style={{ marginRight: "4px" }} />
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave}>
              <Check size={16} style={{ marginRight: "4px" }} />
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default McpSettings;
