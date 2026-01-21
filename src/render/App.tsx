import {
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Moon,
  Plus,
  Send,
  Settings,
  Sun,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import "./App.css";
import EnvironmentSetup from "./EnvironmentSetup";
import NewTaskModal from "./NewTaskModal";
import SettingsModal from "./SettingsModal";
import WorkspaceWelcome from "./WorkspaceWelcome";
import { getDefaultAgentPlugin } from "./agents/registry";

// --- Types ---
declare const DEBUG: string | undefined;

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
    | "permission_request"
    | "agent_plan";
  text?: string;
  toolCallId?: string;
  id?: string; // For permission requests
  name?: string;
  kind?: string;
  status?: string;
  options?: any[];
  tool?: string;
  info?: Partial<AgentInfoState>;
  sessionId?: string;
  plan?: any;
}

interface Task {
  id: string;
  title: string;
  workspace: string;
  agentCommand: string;
  agentEnv: Record<string, string>;
  messages: Message[];
  sessionId: string | null;
  modelId: string | null;
  tokenUsage: TokenUsage | null;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
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
        <div className="system-init-block permission-request-block">
          <div className="permission-title">
            ⚠️ Permission Request
          </div>
          <div style={{ marginBottom: "12px" }}>{msg.content}</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {msg.options?.map((opt: any) => (
              <button
                key={opt.optionId}
                type="button"
                onClick={() => handlePermission(opt.optionId)}
                className="permission-btn"
              >
                {opt.label || opt.name || opt.kind || opt.optionId}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePermission(null)}
              className="permission-btn deny"
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
            className="thought-process-header"
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
              <div className="thought-process-content">
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
          <div className="tool-calls-container">
            {msg.toolCalls.map((tool) => (
              <div key={tool.id} className="tool-call-item">
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
  const [envReady, setEnvReady] = useState<boolean | null>(null); // null = checking
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [agentCommand, setAgentCommand] = useState(getDefaultAgentPlugin().defaultCommand);
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
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [agentCapabilities, setAgentCapabilities] = useState<any | null>(null);
  const [agentMessageLog, setAgentMessageLog] = useState<string[]>([]);
  const showDebug =
    String(DEBUG || "").toLowerCase() === "true" || DEBUG === "1";
  const [taskMenu, setTaskMenu] = useState<{
    taskId: string;
    x: number;
    y: number;
  } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    state: "connecting" | "connected" | "error" | "disconnected";
    message: string;
  }>({ state: "disconnected", message: "Disconnected" });

  // Track if we are waiting for an agent response
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoConnectAttempted = useRef(false);
  const connectInFlight = useRef(false);
  const sessionLoadInFlight = useRef(false);
  const tasksRef = useRef<Task[]>([]);
  const activeTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
  }, [activeTaskId]);

  // Ref to track current generating message ID for stream updates
  const currentAgentMsgId = useRef<string | null>(null);
  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;
  const messages = activeTask?.messages ?? [];

  const persistTaskUpdates = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      window.electron.invoke("db:update-task", taskId, updates);
    },
    [],
  );

  const applyTaskUpdates = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      setTasks((prev) => {
        const next = prev.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task,
        );
        if (updates.lastActiveAt !== undefined) {
          return [...next].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
        }
        return next;
      });
      persistTaskUpdates(taskId, updates);
    },
    [persistTaskUpdates],
  );

  const clearAllSessionIds = useCallback(() => {
    setTasks((prev) => {
      const next = prev.map((task) => ({ ...task, sessionId: null }));
      next.forEach((task) => {
        persistTaskUpdates(task.id, { sessionId: null });
      });
      return next;
    });
  }, [persistTaskUpdates]);

  const syncActiveTaskState = (task: Task | null) => {
    if (!task) return;
    setCurrentWorkspace(task.workspace);
    setAgentCommand(task.agentCommand);
    setAgentEnv(task.agentEnv || {});
    setAgentInfo((prev) => ({
      ...prev,
      currentModelId: task.modelId ?? prev.currentModelId,
      tokenUsage: task.tokenUsage ?? null,
    }));
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Save last workspace when it changes
  useEffect(() => {
    if (currentWorkspace) {
      window.electron.invoke("db:set-last-workspace", currentWorkspace);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    window.electron.invoke("db:set-active-task", activeTaskId);
  }, [activeTaskId]);

  useEffect(() => {
    if (!activeTaskId) {
      return;
    }
    const task = tasks.find((entry) => entry.id === activeTaskId);
    if (!task?.modelId && agentInfo.currentModelId) {
      applyTaskUpdates(activeTaskId, {
        modelId: agentInfo.currentModelId,
        updatedAt: Date.now(),
      });
    }
  }, [activeTaskId, agentInfo.currentModelId, tasks]);

  useEffect(() => {
    if (!isConnected) {
      setAgentCapabilities(null);
      return;
    }
    window.electron
      .invoke("agent:get-capabilities")
      .then((caps) => setAgentCapabilities(caps))
      .catch(() => setAgentCapabilities(null));
  }, [isConnected]);

  useEffect(() => {
    if (!activeTaskId && agentMessageLog.length > 0) {
      setAgentMessageLog([]);
    }
  }, [activeTaskId, agentMessageLog.length]);

  useEffect(() => {
    const handleClick = () => setTaskMenu(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTaskMenu(null);
      }
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleIncomingMessage = useCallback(
    (data: IncomingMessage) => {
      const tasksSnapshot = tasksRef.current;
      const activeTaskIdSnapshot = activeTaskIdRef.current;
      const activeTaskSnapshot =
        tasksSnapshot.find((task) => task.id === activeTaskIdSnapshot) ?? null;
      const messagesSnapshot = activeTaskSnapshot?.messages ?? [];

      if (
        !activeTaskIdSnapshot &&
        !data.sessionId &&
        data.type !== "system" &&
        data.type !== "agent_info" &&
        data.type !== "permission_request"
      ) {
        return;
      }
      const resolveTaskId = (list: Task[]) => {
        if (data.sessionId) {
          const match = list.find((task) => task.sessionId === data.sessionId);
          return match?.id ?? activeTaskIdSnapshot;
        }
        return activeTaskIdSnapshot;
      };
      if (data.type === "agent_info") {
        const resolvedTaskId = data.sessionId
          ? (tasksSnapshot.find((task) => task.sessionId === data.sessionId)
              ?.id ?? activeTaskIdSnapshot)
          : activeTaskIdSnapshot;
        const nextUsage = data.info?.tokenUsage ?? null;
        const baseUsage = activeTaskSnapshot?.tokenUsage ?? null;
        const mergedUsage = nextUsage
          ? {
              promptTokens:
                (baseUsage?.promptTokens ?? 0) + (nextUsage.promptTokens ?? 0),
              completionTokens:
                (baseUsage?.completionTokens ?? 0) +
                (nextUsage.completionTokens ?? 0),
              totalTokens:
                (baseUsage?.totalTokens ?? 0) + (nextUsage.totalTokens ?? 0),
            }
          : baseUsage;
        if (nextUsage) {
          setTasks((prev) =>
            prev.map((task) => {
              if (!resolvedTaskId || task.id !== resolvedTaskId) return task;
              const lastAgentIndex = [...task.messages]
                .reverse()
                .findIndex((msg) => msg.sender === "agent");
              if (lastAgentIndex === -1) {
                return task;
              }
              const realIndex = task.messages.length - 1 - lastAgentIndex;
              const nextMessages = task.messages.map((msg, idx) =>
                idx === realIndex ? { ...msg, tokenUsage: nextUsage } : msg,
              );
              const updatedAt = Date.now();
              persistTaskUpdates(task.id, {
                messages: nextMessages,
                updatedAt,
                lastActiveAt: updatedAt,
              });
              return {
                ...task,
                messages: nextMessages,
                updatedAt,
                lastActiveAt: updatedAt,
              };
            }),
          );
        }
        setAgentInfo((prev) => ({
          models: data.info?.models ?? prev.models,
          currentModelId: data.info?.currentModelId ?? prev.currentModelId,
          commands: data.info?.commands ?? prev.commands,
          tokenUsage: mergedUsage,
        }));
        if (data.info?.currentModelId && resolvedTaskId) {
          applyTaskUpdates(resolvedTaskId, {
            modelId: data.info.currentModelId,
            updatedAt: Date.now(),
            lastActiveAt: Date.now(),
          });
        }
        if (mergedUsage && resolvedTaskId) {
          applyTaskUpdates(resolvedTaskId, {
            tokenUsage: mergedUsage,
            updatedAt: Date.now(),
            lastActiveAt: Date.now(),
          });
        }
        return;
      }

      // System Messages
      if (data.type === "system") {
        const content = data.text || "";
        if (
          content.includes("Agent disconnected") ||
          content.includes("Agent process error")
        ) {
          setIsConnected(false);
          clearAllSessionIds();
          sessionLoadInFlight.current = false;
          setConnectionStatus({
            state: "error",
            message: content.replace(/^System:\s*/, ""),
          });
          return;
        }
        const resolvedTaskId = resolveTaskId(tasksSnapshot);
        const targetTask = resolvedTaskId
          ? tasksSnapshot.find((task) => task.id === resolvedTaskId)
          : null;
        const baseMessages = targetTask?.messages ?? messagesSnapshot;
        if (resolvedTaskId) {
          const updatedAt = Date.now();
          applyTaskUpdates(resolvedTaskId, {
            messages: [
              ...baseMessages,
              {
                id: Date.now().toString(),
                sender: "system" as const,
                content,
              },
            ],
            updatedAt,
            lastActiveAt: updatedAt,
          });
        }
        return;
      }

      if (data.type === "permission_request") {
        const updatedAt = Date.now();
        const resolvedTaskId =
          resolveTaskId(tasksSnapshot) ?? tasksSnapshot[0]?.id ?? null;
        const targetTask = resolvedTaskId
          ? tasksSnapshot.find((task) => task.id === resolvedTaskId)
          : null;
        const baseMessages = targetTask?.messages ?? messagesSnapshot;
        const content =
          (data as any).content ||
          data.text ||
          `Requesting permission to run: ${data.tool || "Unknown tool"}`;
        const normalizedOptions = data.options?.map((opt: any) => ({
          ...opt,
          label: opt.label || opt.name || opt.kind || opt.optionId,
        }));
        if (resolvedTaskId) {
          applyTaskUpdates(resolvedTaskId, {
            messages: [
              ...baseMessages,
              {
                id: Date.now().toString(),
                sender: "system" as const,
                content,
                permissionId: data.id,
                options: normalizedOptions,
              },
            ],
            updatedAt,
            lastActiveAt: updatedAt,
          });
        }
        return;
      }

      if (
        sessionLoadInFlight.current &&
        (data.type === "agent_text" ||
          data.type === "agent_thought" ||
          data.type === "tool_call" ||
          data.type === "tool_call_update")
      ) {
        return;
      }

      // Agent Messages
      setTasks((prev) => {
        const resolvedTaskId = resolveTaskId(prev);
        const targetTask = resolvedTaskId
          ? prev.find((task) => task.id === resolvedTaskId)
          : null;
        if (!targetTask) return prev;
        const lastMsg = targetTask.messages[targetTask.messages.length - 1];
        const isAgentGenerating =
          lastMsg &&
          lastMsg.sender === "agent" &&
          currentAgentMsgId.current === lastMsg.id;

        if (data.type === "agent_text") {
          if (isAgentGenerating) {
            const nextMessages = targetTask.messages.map((m) =>
              m.id === lastMsg.id
                ? { ...m, content: m.content + (data.text || "") }
                : m,
            );
            const updatedAt = Date.now();
            if (resolvedTaskId) {
              persistTaskUpdates(resolvedTaskId, {
                messages: nextMessages,
                updatedAt,
                lastActiveAt: updatedAt,
              });
            }
            return prev.map((task) =>
              task.id === resolvedTaskId
                ? {
                    ...task,
                    messages: nextMessages,
                    updatedAt,
                    lastActiveAt: updatedAt,
                    }
                : task,
            );
          } else {
            const newId = Date.now().toString();
            currentAgentMsgId.current = newId;
            const nextMessages = [
              ...targetTask.messages,
              { id: newId, sender: "agent" as const, content: data.text || "" },
            ];
            const updatedAt = Date.now();
            if (resolvedTaskId) {
              persistTaskUpdates(resolvedTaskId, {
                messages: nextMessages,
                updatedAt,
                lastActiveAt: updatedAt,
              });
            }
            return prev.map((task) =>
              task.id === resolvedTaskId
                ? {
                    ...task,
                    messages: nextMessages,
                    updatedAt,
                    lastActiveAt: updatedAt,
                  }
                : task,
            );
          }
        }

        if (data.type === "agent_thought") {
          if (isAgentGenerating) {
            const nextMessages = targetTask.messages.map((m) =>
              m.id === lastMsg.id
                ? { ...m, thought: (m.thought || "") + (data.text || "") }
                : m,
            );
            const updatedAt = Date.now();
            if (resolvedTaskId) {
              persistTaskUpdates(resolvedTaskId, {
                messages: nextMessages,
                updatedAt,
                lastActiveAt: updatedAt,
              });
            }
            return prev.map((task) =>
              task.id === resolvedTaskId
                ? {
                    ...task,
                    messages: nextMessages,
                    updatedAt,
                    lastActiveAt: updatedAt,
                  }
                : task,
            );
          } else {
            const newId = Date.now().toString();
            currentAgentMsgId.current = newId;
            const nextMessages = [
              ...targetTask.messages,
              {
                id: newId,
                sender: "agent" as const,
                content: "",
                thought: data.text || "",
              },
            ];
            const updatedAt = Date.now();
            if (resolvedTaskId) {
              persistTaskUpdates(resolvedTaskId, {
                messages: nextMessages,
                updatedAt,
                lastActiveAt: updatedAt,
              });
            }
            return prev.map((task) =>
              task.id === resolvedTaskId
                ? {
                    ...task,
                    messages: nextMessages,
                    updatedAt,
                    lastActiveAt: updatedAt,
                  }
                : task,
            );
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
            const nextMessages = targetTask.messages.map((m) =>
              m.id === lastMsg.id
                ? { ...m, toolCalls: [...(m.toolCalls || []), newTool] }
                : m,
            );
            const updatedAt = Date.now();
            if (resolvedTaskId) {
              persistTaskUpdates(resolvedTaskId, {
                messages: nextMessages,
                updatedAt,
                lastActiveAt: updatedAt,
              });
            }
            return prev.map((task) =>
              task.id === resolvedTaskId
                ? {
                    ...task,
                    messages: nextMessages,
                    updatedAt,
                    lastActiveAt: updatedAt,
                  }
                : task,
            );
          }
        }

        if (data.type === "tool_call_update") {
          if (isAgentGenerating) {
            const nextMessages = targetTask.messages.map((m) => {
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
            const updatedAt = Date.now();
            if (resolvedTaskId) {
              persistTaskUpdates(resolvedTaskId, {
                messages: nextMessages,
                updatedAt,
                lastActiveAt: updatedAt,
              });
            }
            return prev.map((task) =>
              task.id === resolvedTaskId
                ? {
                    ...task,
                    messages: nextMessages,
                    updatedAt,
                    lastActiveAt: updatedAt,
                  }
                : task,
            );
          }
        }

        return prev;
      });

      setTimeout(scrollToBottom, 100);
    },
    [applyTaskUpdates, clearAllSessionIds, scrollToBottom, setAgentInfo],
  );

  useEffect(() => {
    // Listen for agent messages
    const removeListener = window.electron.on(
      "agent:message",
      (msg: IncomingMessage | string) => {
        const data: IncomingMessage =
          typeof msg === "string" ? { type: "agent_text", text: msg } : msg;
        console.log("[agent:message]", data);
        setAgentMessageLog((prev) => {
          const next = [
            `[${new Date().toISOString()}] ${JSON.stringify(data)}`,
            ...prev,
          ];
          return next.slice(0, 50);
        });
        handleIncomingMessage(data);
      },
    );

    const loadInitialState = async () => {
      const [storedTasks, storedActiveTaskId, lastWs] = await Promise.all([
        window.electron.invoke("db:list-tasks"),
        window.electron.invoke("db:get-active-task"),
        window.electron.invoke("db:get-last-workspace"),
      ]);

      const loadedTasks = Array.isArray(storedTasks)
        ? storedTasks.map((task) => ({
            ...task,
            agentEnv: task.agentEnv || {},
            messages: Array.isArray(task.messages) ? task.messages : [],
            sessionId: task.sessionId ?? null,
            modelId: task.modelId ?? null,
            tokenUsage: task.tokenUsage ?? null,
          }))
        : [];
      setTasks(loadedTasks);

      const resolvedActiveId = loadedTasks.find(
        (task) => task.id === storedActiveTaskId,
      )
        ? storedActiveTaskId
        : (loadedTasks[0]?.id ?? null);

      if (resolvedActiveId) {
        setActiveTaskId(resolvedActiveId);
        const nextTask = loadedTasks.find(
          (task) => task.id === resolvedActiveId,
        );
        if (nextTask) {
          syncActiveTaskState(nextTask);
        }
      } else if (lastWs) {
        setCurrentWorkspace(lastWs);
      }
    };

    loadInitialState();

    return () => {
      removeListener();
    };
  }, [handleIncomingMessage]);

  const ensureTaskSession = async (task: Task) => {
    if (connectInFlight.current) {
      return null;
    }
    autoConnectAttempted.current = true;
    sessionLoadInFlight.current = false;
    setIsConnected(false);
    setConnectionStatus({
      state: "connecting",
      message: `Connecting to: ${task.agentCommand}...`,
    });

    connectInFlight.current = true;
    try {
      const commandName = task.agentCommand.trim().split(" ")[0];
      if (!commandName) {
        setConnectionStatus({
          state: "error",
          message: "Agent command is empty.",
        });
        return null;
      }
      if (!commandName.includes("/") && !commandName.startsWith(".")) {
        const check = await window.electron.invoke(
          "agent:check-command",
          commandName,
        );
        if (!check.installed) {
          setConnectionStatus({
            state: "error",
            message: `${commandName} not installed. Please check settings.`,
          });
          return null;
        }
      }

      const connectResult = await window.electron.invoke(
        "agent:connect",
        task.agentCommand,
        task.workspace,
        task.agentEnv,
        { reuseIfSame: true, createSession: false },
      );
      if (!connectResult.success) {
        setConnectionStatus({
          state: "error",
          message: `Connection failed: ${connectResult.error}`,
        });
        return null;
      }

      if (!connectResult.reused) {
        clearAllSessionIds();
      }

      let sessionId = connectResult.reused ? task.sessionId : null;
      const caps = await window.electron.invoke("agent:get-capabilities");
      const canResume = Boolean(caps?.sessionCapabilities?.resume);
      const canLoad = Boolean(caps?.loadSession);

      if (connectResult.reused && sessionId) {
        try {
          await window.electron.invoke("agent:set-active-session", sessionId);
        } catch {
          sessionId = null;
        }
      } else if (task.sessionId && (canResume || canLoad)) {
        try {
          if (canResume) {
            await window.electron.invoke(
              "agent:resume-session",
              task.sessionId,
              task.workspace,
            );
            sessionId = task.sessionId;
            applyTaskUpdates(task.id, {
              updatedAt: Date.now(),
              lastActiveAt: Date.now(),
            });
          } else if (canLoad) {
            sessionLoadInFlight.current = true;
            await window.electron.invoke(
              "agent:load-session",
              task.sessionId,
              task.workspace,
            );
            sessionId = task.sessionId;
            applyTaskUpdates(task.id, {
              updatedAt: Date.now(),
              lastActiveAt: Date.now(),
            });
            sessionLoadInFlight.current = false;
          }
        } catch {
          sessionId = null;
          sessionLoadInFlight.current = false;
        }
      }

      if (!sessionId) {
        const sessionResult = await window.electron.invoke(
          "agent:new-session",
          task.workspace,
        );
        sessionId = sessionResult.sessionId;
        applyTaskUpdates(task.id, {
          sessionId,
          updatedAt: Date.now(),
          lastActiveAt: Date.now(),
        });
      }

      setIsConnected(true);
      setConnectionStatus({
        state: "connected",
        message: "Connected.",
      });

      if (task.modelId) {
        await window.electron.invoke("agent:set-model", task.modelId);
      }

      return sessionId;
    } catch (e: any) {
      setIsConnected(false);
      setConnectionStatus({
        state: "error",
        message: `Connection failed: ${e.message}`,
      });
      return null;
    } finally {
      connectInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!activeTask || isConnected || connectInFlight.current) {
      return;
    }
    // removed hardcoded qwen check
    ensureTaskSession(activeTask);
  }, [activeTask, isConnected]);

  const handleConnect = async () => {
    if (connectInFlight.current) {
      return;
    }
    if (isConnected) {
      await window.electron.invoke("agent:disconnect");
      setIsConnected(false);
      clearAllSessionIds();
      sessionLoadInFlight.current = false;
      setAgentInfo({
        models: [],
        currentModelId: null,
        commands: [],
        tokenUsage: null,
      });
      setConnectionStatus({
        state: "disconnected",
        message: "Disconnected.",
      });
      currentAgentMsgId.current = null;
    } else {
      if (!activeTask) {
        setConnectionStatus({
          state: "error",
          message: "No active task selected.",
        });
        return;
      }
      await ensureTaskSession(activeTask);
      setIsSettingsOpen(false);
    }
  };

  const createTaskId = () => {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const handleNewTask = () => {
    setIsNewTaskOpen(true);
  };

  const handleCreateTask = async (payload: {
    title: string;
    workspace: string;
    agentCommand: string;
  }) => {
    const nextWorkspace = payload.workspace;
    const nextCommand = payload.agentCommand;
    const now = Date.now();
    const newTask: Task = {
      id: createTaskId(),
      title: payload.title,
      workspace: nextWorkspace,
      agentCommand: nextCommand,
      agentEnv: agentEnv || {},
      messages: [],
      sessionId: null,
      modelId: null,
      tokenUsage: null,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
    };

    setIsNewTaskOpen(false);
    setTasks((prev) => [newTask, ...prev]);
    window.electron.invoke("db:create-task", newTask);
    setActiveTaskId(newTask.id);
    syncActiveTaskState(newTask);
    await ensureTaskSession(newTask);
  };

  const handleSelectTask = async (taskId: string) => {
    if (activeTaskId === taskId) {
      return;
    }
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }
    const now = Date.now();
    applyTaskUpdates(task.id, { lastActiveAt: now, updatedAt: now });
    currentAgentMsgId.current = null;
    setActiveTaskId(taskId);
    syncActiveTaskState(task);
    await ensureTaskSession(task);
  };

  const handleTaskContextMenu = (taskId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setTaskMenu({
      taskId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = window.confirm(
      "Delete this task? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    const nextTasks = tasks.filter((task) => task.id !== taskId);
    setTasks(nextTasks);
    await window.electron.invoke("db:delete-task", taskId);

    if (activeTaskId !== taskId) {
      return;
    }

    const nextActive = nextTasks[0] || null;
    if (nextActive) {
      setActiveTaskId(nextActive.id);
      syncActiveTaskState(nextActive);
      await ensureTaskSession(nextActive);
    } else {
      setActiveTaskId(null);
      setIsConnected(false);
      clearAllSessionIds();
      sessionLoadInFlight.current = false;
      await window.electron.invoke("agent:disconnect");
      setConnectionStatus({
        state: "disconnected",
        message: "Disconnected.",
      });
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
    if (!activeTaskId) {
      handleIncomingMessage({
        type: "system",
        text: "Error: No active task selected.",
      });
      return;
    }

    sessionLoadInFlight.current = false;

    const text = inputText;
    setInputText("");

    currentAgentMsgId.current = null;
    setIsWaitingForResponse(true);

    if (activeTaskId) {
      const nextMessages = [
        ...messages,
        { id: Date.now().toString(), sender: "user" as const, content: text },
      ];
      const updatedAt = Date.now();
      applyTaskUpdates(activeTaskId, {
        messages: nextMessages,
        updatedAt,
        lastActiveAt: updatedAt,
      });
    }
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
      if (activeTaskId) {
        applyTaskUpdates(activeTaskId, {
          modelId,
          updatedAt: Date.now(),
          lastActiveAt: Date.now(),
        });
      }
      setIsModelMenuOpen(false);
    } catch (e: any) {
      handleIncomingMessage({
        type: "system",
        text: `Model switch failed: ${e.message}`,
      });
    }
  };

  const handleAgentCommandChange = (value: string) => {
    setAgentCommand(value);
    if (activeTaskId) {
      applyTaskUpdates(activeTaskId, {
        agentCommand: value,
        updatedAt: Date.now(),
        lastActiveAt: Date.now(),
      });
    }
  };

  const handleAgentEnvChange = (env: Record<string, string>) => {
    setAgentEnv(env);
    if (activeTaskId) {
      applyTaskUpdates(activeTaskId, {
        agentEnv: env,
        updatedAt: Date.now(),
        lastActiveAt: Date.now(),
      });
    }
  };

  // Check environment on mount
  useEffect(() => {
    const checkEnv = async () => {
      try {
        const result = await window.electron.invoke("env:check");
        if (result.node.installed && result.npm.installed) {
          // Check version
          const versionMatch = result.node.version?.match(/^v?(\d+)/);
          const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;
          setEnvReady(majorVersion >= 18);
        } else {
          setEnvReady(false);
        }
      } catch {
        setEnvReady(false);
      }
    };
    checkEnv();
  }, []);

  // Show environment setup if not ready
  if (envReady === null) {
    // Still checking
    return (
      <div className="app-layout" style={{ alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="spin" size={32} />
      </div>
    );
  }

  if (!envReady) {
    return <EnvironmentSetup onReady={() => setEnvReady(true)} />;
  }

  if (!currentWorkspace && tasks.length === 0) {
    return (
      <WorkspaceWelcome
        onSelect={(path) => {
          setCurrentWorkspace(path);
          setIsNewTaskOpen(true);
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        agentCommand={agentCommand}
        onAgentCommandChange={handleAgentCommandChange}
        agentEnv={agentEnv}
        onAgentEnvChange={handleAgentEnvChange}
        isConnected={isConnected}
        onConnectToggle={handleConnect}
        currentWorkspace={currentWorkspace}
      />
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onCreate={handleCreateTask}
        initialWorkspace={currentWorkspace}
        initialAgentCommand={agentCommand}
      />

      {/* Sidebar */}
      <div className="sidebar">
        <button type="button" className="new-chat-btn" onClick={handleNewTask}>
          <Plus size={16} />
          <span>New Task</span>
        </button>

        <div className="history-list">
          {tasks.length === 0 ? (
            <div className="history-empty">No tasks yet.</div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`history-item ${
                  task.id === activeTaskId ? "active" : ""
                }`}
                onClick={() => handleSelectTask(task.id)}
                onContextMenu={(event) => handleTaskContextMenu(task.id, event)}
              >
                <div className="history-item-row">
                  <div className="history-item-title">{task.title}</div>
                </div>
                <div className="history-item-subtitle" title={task.workspace}>
                  {task.workspace.split("/").pop() || task.workspace}
                </div>
              </div>
            ))
          )}
        </div>

        {taskMenu && (
          <div
            className="task-context-menu"
            style={{ top: taskMenu.y, left: taskMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="task-context-menu-item danger"
              onClick={() => {
                const taskId = taskMenu.taskId;
                setTaskMenu(null);
                handleDeleteTask(taskId);
              }}
            >
              Delete Task
            </button>
          </div>
        )}

        <div className="sidebar-settings">
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="sidebar-settings-button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open settings"
              style={{ flex: 1 }}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
            <button
              type="button"
              className="sidebar-settings-button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{ width: "auto", padding: "10px" }}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="chat-header">
          <div className="header-left">
            <div
              className={`connection-status ${connectionStatus.state}`}
              title={`Status: ${connectionStatus.state}`}
            >
              <div className="status-dot-container">
                <div className={`status-dot ${connectionStatus.state}`} />
                <div className="status-glow" />
              </div>
              <span className="status-label">
                {connectionStatus.state === "connected"
                  ? "System Connected"
                  : connectionStatus.state === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
              </span>
            </div>
            
            {currentWorkspace && (
              <>
                <div className="header-divider" />
                <div className="workspace-info">
                  <span className="folder-icon">📂</span>
                  <span className="workspace-path" title={currentWorkspace}>
                    {currentWorkspace.split("/").pop()}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="header-right">
            {agentInfo.models.length > 0 && (
              <div className="model-selector">
                <button
                  type="button"
                  className="model-selector-trigger"
                  onClick={() => setIsModelMenuOpen((prev) => !prev)}
                >
                  <span className="model-current-name">
                    {currentModel?.name || agentInfo.currentModelId || "Unknown"}
                  </span>
                  <ChevronDown size={14} className="model-arrow" />
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
        </div>

        <div className="messages-container">
          {showDebug && (
            <div
              style={{
                fontSize: "0.75rem",
                color: "#9ca3af",
                backgroundColor: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "8px 10px",
                marginBottom: "12px",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {`agentInfo=${JSON.stringify(agentInfo, null, 2)}\nagentCapabilities=${JSON.stringify(
                agentCapabilities,
                null,
                2,
              )}\nagentMessageLog=${JSON.stringify(agentMessageLog, null, 2)}`}
            </div>
          )}
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
