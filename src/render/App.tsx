import { theme as antdTheme, ConfigProvider } from "antd";
import { Loader2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./tailwind.css";
import { getDefaultAgentPlugin } from "./agents/registry";
import { AntDXMessage, ChatHeader, ChatInput, Sidebar } from "./components";
import EnvironmentSetup from "./EnvironmentSetup";
import NewTaskModal from "./NewTaskModal";
import SettingsModal from "./SettingsModal";
import type {
  AgentCommandInfo,
  AgentInfoState,
  ConnectionStatus,
  ImageAttachment,
  IncomingMessage,
  Task,
  ToolCall,
} from "./types";
import WorkspaceWelcome from "./WorkspaceWelcome";

// --- Types ---
declare const DEBUG: string | undefined;

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

// --- Main App ---

const App = () => {
  const [envReady, setEnvReady] = useState<boolean | null>(null); // null = checking
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [inputImages, setInputImages] = useState<ImageAttachment[]>([]);
  const [agentCommand, setAgentCommand] = useState(
    getDefaultAgentPlugin().defaultCommand,
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
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [agentCapabilities, setAgentCapabilities] = useState<any | null>(null);
  const [agentMessageLog, setAgentMessageLog] = useState<string[]>([]);
  const showDebug =
    String(DEBUG || "").toLowerCase() === "true" || DEBUG === "1";

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: "disconnected",
    message: "Disconnected",
  });

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
        // 永远按照创建时间倒序排序
        return [...next].sort((a, b) => b.createdAt - a.createdAt);
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

  const handlePermissionResponse = useCallback(
    async (permissionId: string, optionId: string | null) => {
      const response = optionId
        ? { outcome: { outcome: "selected", optionId } }
        : { outcome: { outcome: "cancelled" } };
      await window.electron.invoke(
        "agent:permission-response",
        permissionId,
        response,
      );
    },
    [],
  );

  // Save last workspace when it changes
  useEffect(() => {
    if (currentWorkspace && window.electron) {
      window.electron.invoke("db:set-last-workspace", currentWorkspace);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (window.electron) {
      window.electron.invoke("db:set-active-task", activeTaskId);
    }
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
    if (window.electron) {
      window.electron
        .invoke("agent:get-capabilities")
        .then((caps) => setAgentCapabilities(caps))
        .catch(() => setAgentCapabilities(null));
    }
  }, [isConnected]);

  useEffect(() => {
    if (!activeTaskId && agentMessageLog.length > 0) {
      setAgentMessageLog([]);
    }
  }, [activeTaskId, agentMessageLog.length]);

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
      // Clear waiting state when receiving agent messages
      if (
        data.type === "agent_text" ||
        data.type === "agent_thought" ||
        data.type === "tool_call"
      ) {
        setIsWaitingForResponse(false);
      }

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
              id:
                data.toolCallId ||
                `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              name: data.name || "Unknown Tool",
              kind: data.kind,
              status: (data.status as any) || "in_progress",
              result: {
                rawInput: data.rawInput,
                rawOutput: data.rawOutput,
              },
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
          } else {
            // 如果没有正在生成的代理消息，创建一个新的消息来显示工具调用
            const newId = Date.now().toString();
            currentAgentMsgId.current = newId;
            const newTool: ToolCall = {
              id:
                data.toolCallId ||
                `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              name: data.name || "Unknown Tool",
              kind: data.kind,
              status: (data.status as any) || "in_progress",
              result: {
                rawInput: data.rawInput,
                rawOutput: data.rawOutput,
              },
            };
            const nextMessages = [
              ...targetTask.messages,
              {
                id: newId,
                sender: "agent" as const,
                content: "",
                toolCalls: [newTool],
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

        if (data.type === "tool_call_update") {
          // 查找包含指定 toolCallId 的代理消息
          const targetMsgIndex = targetTask.messages.findIndex(
            (m) =>
              m.sender === "agent" &&
              m.toolCalls?.some((t) => t.id === data.toolCallId),
          );

          if (targetMsgIndex !== -1) {
            // 更新工具调用状态
            const nextMessages = [...targetTask.messages];
            const targetMsg = { ...nextMessages[targetMsgIndex] };
            targetMsg.toolCalls = targetMsg.toolCalls?.map((t) =>
              t.id === data.toolCallId
                ? {
                    ...t,
                    status: data.status as any,
                    result: {
                      ...t.result,
                      rawInput:
                        data.rawInput !== undefined
                          ? data.rawInput
                          : t.result?.rawInput,
                      rawOutput:
                        data.rawOutput !== undefined
                          ? data.rawOutput
                          : t.result?.rawOutput,
                    },
                  }
                : t,
            );
            nextMessages[targetMsgIndex] = targetMsg;

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
            // 如果没有找到包含该 toolCallId 的消息，创建一个新的消息
            const newId = Date.now().toString();
            currentAgentMsgId.current = newId;
            const newTool: ToolCall = {
              id:
                data.toolCallId ||
                `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              name: "Unknown Tool",
              status: (data.status as any) || "in_progress",
              result: {
                rawInput: data.rawInput,
                rawOutput: data.rawOutput,
              },
            };
            const nextMessages = [
              ...targetTask.messages,
              {
                id: newId,
                sender: "agent" as const,
                content: "",
                toolCalls: [newTool],
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

        return prev;
      });

      setTimeout(scrollToBottom, 100);
    },
    [applyTaskUpdates, clearAllSessionIds, scrollToBottom, setAgentInfo],
  );

  useEffect(() => {
    // Listen for agent messages
    if (!window.electron) {
      return;
    }
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
      // 按创建时间倒序排序
      setTasks([...loadedTasks].sort((a, b) => b.createdAt - a.createdAt));

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
    if (!isConnected) {
      setIsConnected(false);
    }
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
          await window.electron.invoke(
            "agent:set-active-session",
            sessionId,
            task.workspace,
          );
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
      if (!isConnected) {
        setIsConnected(false);
      }
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
    // 按创建时间倒序排序，新任务会自动在最前面
    setTasks((prev) => [...prev, newTask].sort((a, b) => b.createdAt - a.createdAt));
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

  const handleRenameTask = (taskId: string, newTitle: string) => {
    applyTaskUpdates(taskId, { title: newTitle, updatedAt: Date.now() });
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

  const handleStop = async () => {
    try {
      await window.electron.invoke("agent:stop");
      setIsWaitingForResponse(false);
      currentAgentMsgId.current = null;
    } catch (e: any) {
      console.error("Stop error:", e);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && inputImages.length === 0) return;
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
    const images = [...inputImages];
    setInputText("");
    setInputImages([]);

    currentAgentMsgId.current = null;

    if (activeTaskId) {
      const nextMessages = [
        ...messages,
        {
          id: Date.now().toString(),
          sender: "user" as const,
          content: text,
          images: images,
        },
      ];
      const updatedAt = Date.now();
      applyTaskUpdates(activeTaskId, {
        messages: nextMessages,
        updatedAt,
        lastActiveAt: updatedAt,
      });
    }
    setTimeout(scrollToBottom, 100);

    // Set loading state after scroll to ensure the loading bubble is visible
    setIsWaitingForResponse(true);

    try {
      await window.electron.invoke("agent:send", text, images);
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

  const handleCommandPick = (cmd: AgentCommandInfo) => {
    setInputText(`/${cmd.name} `);
    setIsCommandMenuOpen(false);
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
      <div className="flex h-screen w-screen overflow-hidden bg-app items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
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
    <ConfigProvider
      theme={{
        algorithm:
          theme === "dark"
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#f97316",
        },
      }}
    >
      <div className="flex h-screen w-screen overflow-hidden bg-app">
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

        <Sidebar
          tasks={tasks}
          activeTaskId={activeTaskId}
          onNewTask={handleNewTask}
          onSelectTask={handleSelectTask}
          onDeleteTask={handleDeleteTask}
          onRenameTask={handleRenameTask}
          onOpenSettings={() => setIsSettingsOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative bg-app">
          <ChatHeader
            connectionStatus={connectionStatus}
            currentWorkspace={currentWorkspace}
            models={agentInfo.models}
            currentModelId={agentInfo.currentModelId}
            isModelMenuOpen={isModelMenuOpen}
            onToggleModelMenu={() => setIsModelMenuOpen((prev) => !prev)}
            onModelPick={handleModelPick}
            showDebug={showDebug}
            agentInfo={agentInfo}
            agentCapabilities={agentCapabilities}
            agentMessageLog={agentMessageLog}
          />

          <div className="flex-1 overflow-y-auto px-10 py-5 flex flex-col gap-8 w-full">
            {/* Welcome / Empty State */}
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 mt-10">
                <div className="mb-2">Beginning of conversation</div>
                <div className="w-10 h-px bg-gray-200 mx-auto dark:bg-gray-700" />
              </div>
            ) : null}

            {messages.map((msg) => (
              <AntDXMessage
                key={msg.id}
                msg={msg}
                onPermissionResponse={handlePermissionResponse}
              />
            ))}

            {/* Loading message bubble */}
            {isWaitingForResponse && (
              <AntDXMessage
                msg={{ id: "loading", sender: "agent", content: "" }}
                isLoading
                onStop={handleStop}
              />
            )}

            <div ref={messagesEndRef} />
          </div>

          <ChatInput
            inputText={inputText}
            onInputChange={setInputText}
            onSend={handleSend}
            isConnected={isConnected}
            isCommandMenuOpen={isCommandMenuOpen}
            filteredCommands={filteredCommands}
            commandSelectedIndex={commandSelectedIndex}
            onCommandPick={handleCommandPick}
            onKeyDown={handleKeyDown}
            images={inputImages}
            onImagesChange={setInputImages}
          />
        </div>
      </div>
    </ConfigProvider>
  );
};

export default App;
