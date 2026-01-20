import {
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Send,
  Settings,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import "./App.css";
import SettingsModal from "./SettingsModal";
import WorkspaceWelcome from "./WorkspaceWelcome";

// --- Types ---

interface ToolCall {
  id: string;
  name: string;
  kind?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: any;
}

interface AgentModelInfo {
  modelId: string;
  name: string;
  description?: string | null;
}

interface AgentCommandInfo {
  name: string;
  description?: string | null;
}

interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface AgentInfoState {
  models: AgentModelInfo[];
  currentModelId: string | null;
  commands: AgentCommandInfo[];
  tokenUsage: TokenUsage | null;
}

const LOCAL_COMMANDS: AgentCommandInfo[] = [];

const mergeCommands = (
  agentCommands: AgentCommandInfo[],
  localCommands: AgentCommandInfo[],
) => {
  const merged = new Map<string, AgentCommandInfo>();
  for (const cmd of localCommands) {
    merged.set(cmd.name, cmd);
  }
  for (const cmd of agentCommands) {
    merged.set(cmd.name, cmd);
  }
  return [...merged.values()];
};

interface Message {
  id: string;
  sender: "user" | "agent" | "system";
  content: string; // Markdown text
  thought?: string; // Thought process
  toolCalls?: ToolCall[];
  tokenUsage?: TokenUsage;
  // Permission Request Fields
  permissionId?: string;
  options?: any[];
}

interface IncomingMessage {
  type:
    | "agent_text"
    | "agent_thought"
    | "agent_info"
    | "tool_call"
    | "tool_call_update"
    | "tool_log"
    | "system"
    | "permission_request";
  text?: string;
  toolCallId?: string;
  id?: string; // For permission requests
  name?: string;
  kind?: string;
  status?: string;
  options?: any[];
  tool?: string;
  info?: Partial<AgentInfoState>;
}

// --- Components ---

const MessageBubble = ({ msg }: { msg: Message }) => {
  const isUser = msg.sender === "user";
  const isSystem = msg.sender === "system";
  const [isThoughtOpen, setIsThoughtOpen] = useState(false);

  // Permission Request UI
  if (msg.permissionId) {
    const handlePermission = async (optionId: string | null) => {
      let response;
      if (optionId) {
        response = { outcome: { outcome: "selected", optionId } };
      } else {
        response = { outcome: { outcome: "cancelled" } };
      }
      await window.electron.invoke(
        "agent:permission-response",
        msg.permissionId,
        response,
      );
      // Optimistically update UI (remove options, show decision)
      // In a real app, we might wait for confirmation or update message state
    };

    return (
      <div className="message-wrapper" style={{ alignItems: "center" }}>
        <div
          className="system-init-block"
          style={{ border: "1px solid #f97316" }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, color: "#ea580c" }}>
            ⚠️ Permission Request
          </div>
          <div style={{ marginBottom: "12px" }}>{msg.content}</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {msg.options?.map((opt: any) => (
              <button
                key={opt.optionId}
                type="button"
                onClick={() => handlePermission(opt.optionId)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontSize: "0.9em",
                }}
              >
                {opt.label || opt.kind}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePermission(null)}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                border: "1px solid #ef4444",
                backgroundColor: "#fff",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: "0.9em",
              }}
            >
              Deny
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="message-wrapper" style={{ alignItems: "center" }}>
        <div className="system-init-block">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            System Notification
          </div>
          <div>{msg.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-wrapper">
      <div className={`message-role ${isUser ? "user" : "assistant"}`}>
        {isUser ? "User" : "Assistant"}
      </div>

      <div className="message-content">
        {/* Thought Process (Collapsible) */}
        {msg.thought && (
          <div
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "0.9em",
              color: "#6b7280",
              border: "1px solid #e5e7eb",
              cursor: "pointer",
              marginBottom: "12px",
            }}
            onClick={() => setIsThoughtOpen(!isThoughtOpen)}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 500,
              }}
            >
              <Brain size={14} />
              <span>Thinking Process</span>
              {isThoughtOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </div>
            {isThoughtOpen && (
              <div
                style={{
                  marginTop: "8px",
                  whiteSpace: "pre-wrap",
                  fontStyle: "italic",
                  paddingLeft: "20px",
                }}
              >
                {msg.thought}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        {msg.content && (
          <div className="markdown-content">
            {isUser ? (
              <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
            ) : (
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props) {
                    const { children, className, node, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || "");
                    return match ? (
                      // @ts-expect-error
                      <SyntaxHighlighter
                        {...rest}
                        PreTag="div"
                        language={match[1]}
                        style={vscDarkPlus}
                        customStyle={{
                          borderRadius: "8px",
                          fontSize: "0.85em",
                          margin: 0,
                        }}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code
                        {...rest}
                        className={className}
                        style={{
                          backgroundColor: "#f3f4f6",
                          padding: "2px 4px",
                          borderRadius: "4px",
                          color: "#ef4444",
                        }}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {msg.content}
              </Markdown>
            )}
          </div>
        )}

        {!isUser && msg.tokenUsage && (
          <div className="message-usage">
            Tokens: prompt {msg.tokenUsage.promptTokens ?? 0}, completion{" "}
            {msg.tokenUsage.completionTokens ?? 0}, total{" "}
            {msg.tokenUsage.totalTokens ??
              (msg.tokenUsage.promptTokens ?? 0) +
                (msg.tokenUsage.completionTokens ?? 0)}
          </div>
        )}

        {/* Tool Calls */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            {msg.toolCalls.map((tool) => (
              <div
                key={tool.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "0.85em",
                  color: "#374151",
                }}
              >
                {tool.status === "pending" || tool.status === "in_progress" ? (
                  <Loader2 size={14} className="animate-spin" color="#f97316" />
                ) : tool.status === "completed" ? (
                  <CheckCircle size={14} color="#10b981" />
                ) : (
                  <XCircle size={14} color="#ef4444" />
                )}
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                  {tool.name}
                </span>
                <span style={{ color: "#9ca3af" }}>— {tool.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App ---

const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [agentCommand, setAgentCommand] = useState(
    "qwen --acp --allowed-tools run_shell_command --experimental-skills",
  );
  const [agentEnv, setAgentEnv] = useState<Record<string, string>>({});
  const [agentInfo, setAgentInfo] = useState<AgentInfoState>({
    models: [],
    currentModelId: null,
    commands: [],
    tokenUsage: null,
  });
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoConnectAttempted = useRef(false);

  // Ref to track current generating message ID for stream updates
  const currentAgentMsgId = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Setup once
  useEffect(() => {
    // Listen for agent messages
    const removeListener = window.electron.on(
      "agent:message",
      (msg: IncomingMessage | string) => {
        // Normalize
        const data: IncomingMessage =
          typeof msg === "string" ? { type: "agent_text", text: msg } : msg;
        handleIncomingMessage(data);
      },
    );

    // Load last workspace
    window.electron
      .invoke("db:get-last-workspace")
      .then((lastWs: string | null) => {
        if (lastWs) {
          setCurrentWorkspace(lastWs);
        }
      });

    return () => {
      removeListener();
    };
  }, []);

  // Save last workspace when it changes
  useEffect(() => {
    if (currentWorkspace) {
      window.electron.invoke("db:set-last-workspace", currentWorkspace);
    }
  }, [currentWorkspace]);

  // Auto-resize textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: Logic requires this
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  useEffect(() => {
    if (inputText.startsWith("/")) {
      setIsCommandMenuOpen(true);
      setCommandSelectedIndex(0);
    } else {
      setIsCommandMenuOpen(false);
    }
  }, [inputText]);

  const handleIncomingMessage = (data: IncomingMessage) => {
    if (data.type === "agent_info") {
      const nextUsage = data.info?.tokenUsage ?? null;
      if (nextUsage) {
        setMessages((prev) => {
          const lastAgentIndex = [...prev]
            .reverse()
            .findIndex((msg) => msg.sender === "agent");
          if (lastAgentIndex === -1) {
            return prev;
          }
          const realIndex = prev.length - 1 - lastAgentIndex;
          return prev.map((msg, idx) =>
            idx === realIndex ? { ...msg, tokenUsage: nextUsage } : msg,
          );
        });
      }
      setAgentInfo((prev) => ({
        models: data.info?.models ?? prev.models,
        currentModelId: data.info?.currentModelId ?? prev.currentModelId,
        commands: data.info?.commands ?? prev.commands,
        tokenUsage: nextUsage
          ? {
              promptTokens:
                (prev.tokenUsage?.promptTokens ?? 0) +
                (nextUsage.promptTokens ?? 0),
              completionTokens:
                (prev.tokenUsage?.completionTokens ?? 0) +
                (nextUsage.completionTokens ?? 0),
              totalTokens:
                (prev.tokenUsage?.totalTokens ?? 0) +
                (nextUsage.totalTokens ?? 0),
            }
          : prev.tokenUsage,
      }));
      return;
    }

    // System Messages
    if (data.type === "system") {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "system",
          content: data.text || "",
        },
      ]);
      return;
    }

    if (data.type === "permission_request") {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "system",
          content: `Requesting permission to run tool: ${data.tool}`,
          permissionId: data.id,
          options: data.options,
        },
      ]);
      return;
    }

    // Agent Messages
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      const isAgentGenerating =
        lastMsg &&
        lastMsg.sender === "agent" &&
        currentAgentMsgId.current === lastMsg.id;

      if (data.type === "agent_text") {
        if (isAgentGenerating) {
          return prev.map((m) =>
            m.id === lastMsg.id
              ? { ...m, content: m.content + (data.text || "") }
              : m,
          );
        } else {
          const newId = Date.now().toString();
          currentAgentMsgId.current = newId;
          return [
            ...prev,
            { id: newId, sender: "agent", content: data.text || "" },
          ];
        }
      }

      if (data.type === "agent_thought") {
        if (isAgentGenerating) {
          return prev.map((m) =>
            m.id === lastMsg.id
              ? { ...m, thought: (m.thought || "") + (data.text || "") }
              : m,
          );
        } else {
          const newId = Date.now().toString();
          currentAgentMsgId.current = newId;
          return [
            ...prev,
            {
              id: newId,
              sender: "agent",
              content: "",
              thought: data.text || "",
            },
          ];
        }
      }

      if (data.type === "tool_call") {
        if (isAgentGenerating) {
          const newTool: ToolCall = {
            id: data.toolCallId || "",
            name: data.name || "Unknown Tool",
            kind: data.kind,
            status: (data.status as any) || "in_progress",
          };
          return prev.map((m) =>
            m.id === lastMsg.id
              ? { ...m, toolCalls: [...(m.toolCalls || []), newTool] }
              : m,
          );
        }
      }

      if (data.type === "tool_call_update") {
        if (isAgentGenerating) {
          return prev.map((m) => {
            if (m.id !== lastMsg.id) return m;
            return {
              ...m,
              toolCalls: m.toolCalls?.map((t) =>
                t.id === data.toolCallId
                  ? { ...t, status: data.status as any }
                  : t,
              ),
            };
          });
        }
      }

      return prev;
    });

    setTimeout(scrollToBottom, 100);
  };

  useEffect(() => {
    const tryAutoConnect = async () => {
      if (!currentWorkspace || isConnected || autoConnectAttempted.current) {
        return;
      }

      if (!agentCommand.includes("qwen")) {
        return;
      }

      autoConnectAttempted.current = true;
      handleIncomingMessage({
        type: "system",
        text: "Auto-connecting to Qwen...",
      });

      try {
        const check = await window.electron.invoke(
          "agent:check-command",
          "qwen",
        );
        if (!check.installed) {
          handleIncomingMessage({
            type: "system",
            text: "Qwen not installed. Please install it in Settings.",
          });
          return;
        }

        const result = await window.electron.invoke(
          "agent:connect",
          agentCommand,
          currentWorkspace,
          agentEnv,
        );
        if (result.success) {
          setIsConnected(true);
          handleIncomingMessage({ type: "system", text: "Connected!" });
        } else {
          handleIncomingMessage({
            type: "system",
            text: `Connection failed: ${result.error}`,
          });
        }
      } catch (e: any) {
        handleIncomingMessage({
          type: "system",
          text: `Connection failed: ${e.message}`,
        });
      }
    };

    tryAutoConnect();
  }, [agentCommand, agentEnv, currentWorkspace, isConnected]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleConnect = async () => {
    if (isConnected) {
      await window.electron.invoke("agent:disconnect");
      setIsConnected(false);
      setAgentInfo({
        models: [],
        currentModelId: null,
        commands: [],
        tokenUsage: null,
      });
      handleIncomingMessage({ type: "system", text: "Disconnected." });
      currentAgentMsgId.current = null;
    } else {
      handleIncomingMessage({
        type: "system",
        text: `Connecting to: ${agentCommand}...`,
      });
      const result = await window.electron.invoke(
        "agent:connect",
        agentCommand,
        currentWorkspace,
        agentEnv,
      );
      if (result.success) {
        setIsConnected(true);
        handleIncomingMessage({ type: "system", text: "Connected!" });
        setIsSettingsOpen(false); // Close settings on successful connection
      } else {
        handleIncomingMessage({
          type: "system",
          text: `Connection failed: ${result.error}`,
        });
      }
    }
  };

  const handleNewTask = async () => {
    // Clear messages
    setMessages([]);
    currentAgentMsgId.current = null;
    setAgentInfo((prev) => ({
      ...prev,
      tokenUsage: null,
    }));

    // Reset session if connected
    if (isConnected && currentWorkspace) {
      handleIncomingMessage({ type: "system", text: "Starting new task..." });
      // We can reuse the connect logic to restart the agent process/session
      const result = await window.electron.invoke(
        "agent:connect",
        agentCommand,
        currentWorkspace,
        agentEnv,
      );
      if (result.success) {
        handleIncomingMessage({ type: "system", text: "New session started." });
      } else {
        handleIncomingMessage({
          type: "system",
          text: `Failed to restart session: ${result.error}`,
        });
        setIsConnected(false);
      }
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    if (!isConnected) {
      handleIncomingMessage({
        type: "system",
        text: "Error: Not connected to agent.",
      });
      return;
    }

    const text = inputText;
    setInputText("");

    currentAgentMsgId.current = null;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), sender: "user", content: text },
    ]);
    setTimeout(scrollToBottom, 100);

    try {
      await window.electron.invoke("agent:send", text);
    } catch (e: any) {
      handleIncomingMessage({
        type: "system",
        text: `Send error: ${e.message}`,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCommandMenuOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setCommandSelectedIndex((prev) => {
          const max = filteredCommands.length;
          if (max === 0) return 0;
          if (e.key === "ArrowDown") {
            return (prev + 1) % max;
          }
          return (prev - 1 + max) % max;
        });
        return;
      }

      if (e.key === "Enter") {
        if (filteredCommands.length > 0) {
          e.preventDefault();
          handleCommandPick(filteredCommands[commandSelectedIndex]);
          return;
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setIsCommandMenuOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentModel = agentInfo.models.find(
    (model) => model.modelId === agentInfo.currentModelId,
  );
  const mergedCommands = useMemo(
    () => mergeCommands(agentInfo.commands, LOCAL_COMMANDS),
    [agentInfo.commands],
  );
  const commandQuery = inputText.startsWith("/")
    ? inputText.slice(1).trim().toLowerCase()
    : "";
  const filteredCommands = mergedCommands.filter((cmd) =>
    commandQuery ? cmd.name.toLowerCase().includes(commandQuery) : true,
  );

  useEffect(() => {
    if (commandSelectedIndex >= filteredCommands.length) {
      setCommandSelectedIndex(0);
    }
  }, [commandSelectedIndex, filteredCommands.length]);

  const handleCommandPick = (cmd: AgentCommandInfo) => {
    setInputText(`/${cmd.name} `);
    setIsCommandMenuOpen(false);
    textareaRef.current?.focus();
  };

  const handleModelPick = async (modelId: string) => {
    try {
      const res = await window.electron.invoke("agent:set-model", modelId);
      if (!res.success) {
        handleIncomingMessage({
          type: "system",
          text: `Model switch failed: ${res.error || "unknown error"}`,
        });
        return;
      }
      setAgentInfo((prev) => ({ ...prev, currentModelId: modelId }));
      setIsModelMenuOpen(false);
    } catch (e: any) {
      handleIncomingMessage({
        type: "system",
        text: `Model switch failed: ${e.message}`,
      });
    }
  };

  if (!currentWorkspace) {
    return <WorkspaceWelcome onSelect={setCurrentWorkspace} />;
  }

  return (
    <div className="app-layout">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        agentCommand={agentCommand}
        onAgentCommandChange={setAgentCommand}
        agentEnv={agentEnv}
        onAgentEnvChange={setAgentEnv}
        isConnected={isConnected}
        onConnectToggle={handleConnect}
        currentWorkspace={currentWorkspace}
      />

      {/* Sidebar */}
      <div className="sidebar">
        <button type="button" className="new-chat-btn" onClick={handleNewTask}>
          <Plus size={16} />
          <span>New Task</span>
        </button>

        <div className="history-list">
          <div className="history-item active">
            <div className="history-item-title">Current Workspace</div>
            <div className="history-item-subtitle" title={currentWorkspace}>
              {currentWorkspace.split("/").pop()}
            </div>
          </div>
          {/* Mock items */}
          {/* <div className="history-item">
                  <div className="history-item-title">Refactor Auth</div>
                  <div className="history-item-subtitle">2 hours ago</div>
              </div> */}
        </div>

        <div className="sidebar-settings">
          <button
            type="button"
            className="sidebar-settings-button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        {/* Connection Overlay (Top Right) - REMOVED */}

        <div className="chat-header">
          <div className="agent-info-bar">
            <div className="agent-info-item">
              {agentInfo.models.length === 0 ? (
                <span className="agent-info-muted">Unknown</span>
              ) : (
                <div className="model-selector">
                  <button
                    type="button"
                    className="model-selector-trigger compact"
                    onClick={() => setIsModelMenuOpen((prev) => !prev)}
                  >
                    <span>
                      {currentModel?.name ||
                        agentInfo.currentModelId ||
                        "Unknown"}
                    </span>
                    <ChevronDown size={12} />
                  </button>
                  {isModelMenuOpen && (
                    <div className="model-dropdown">
                      {agentInfo.models.map((model) => (
                        <button
                          key={model.modelId}
                          type="button"
                          className={`model-item ${
                            model.modelId === agentInfo.currentModelId
                              ? "active"
                              : ""
                          }`}
                          onClick={() => handleModelPick(model.modelId)}
                        >
                          <span className="model-name">{model.name}</span>
                          <span className="model-desc">
                            {model.description || model.modelId}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="agent-info-item">
              {isConnected ? (
                <span
                  className="agent-status connected"
                  aria-label="Connected"
                />
              ) : (
                <span
                  className="agent-status disconnected"
                  aria-label="Disconnected"
                />
              )}
            </div>
          </div>
        </div>

        <div className="messages-container">
          {/* Welcome / Empty State */}
          {messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "#9ca3af",
                marginTop: "40px",
              }}
            >
              <div style={{ marginBottom: "8px" }}>
                Beginning of conversation
              </div>
              <div
                style={{
                  width: "40px",
                  height: "1px",
                  backgroundColor: "#e5e7eb",
                  margin: "0 auto",
                }}
              ></div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-box">
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want agent to handle..."
              rows={1}
              disabled={!isConnected}
            />
            <button
              type="button"
              className="send-button"
              onClick={handleSend}
              disabled={!isConnected || !inputText.trim()}
            >
              <Send size={16} />
            </button>
            {isCommandMenuOpen && (
              <div className="command-dropdown">
                {filteredCommands.length === 0 ? (
                  <div className="command-empty">No commands available.</div>
                ) : (
                  filteredCommands.map((cmd, index) => (
                    <button
                      key={cmd.name}
                      type="button"
                      className={`command-item ${
                        index === commandSelectedIndex ? "active" : ""
                      }`}
                      onClick={() => handleCommandPick(cmd)}
                    >
                      <span className="command-name">/{cmd.name}</span>
                      <span className="command-desc">
                        {cmd.description || "No description"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
