import { theme as antdTheme, ConfigProvider } from "antd";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./tailwind.css";
import "./theme.css";
import { getDefaultAgentPlugin } from "./agents/registry";
import { ChatHeader, MessageRenderer, SendBox, Sidebar } from "./components";
import EnvironmentSetup from "./EnvironmentSetup";
import NewTaskModal from "./NewTaskModal";
import SettingsModal from "./SettingsModal";
import type {
  AgentInfoState,
  ConnectionStatus,
  ImageAttachment,
  IncomingMessage,
  Task,
} from "./types";
import { MessageComposer } from "./utils/messageComposer";
import {
  transformIncomingMessage,
  transformMessages,
  transformToLegacyMessages,
} from "./utils/messageTransformer";
import { isWallpaperGradient, wallpaperUrl } from "./utils/wallpaper";
import WorkspaceWelcome from "./WorkspaceWelcome";

// --- Types ---
declare const DEBUG: string | undefined;

// --- Main App ---

const App = () => {
  const [envReady, setEnvReady] = useState<boolean | null>(null); // null = checking
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [inputTextByTask, setInputTextByTask] = useState<Record<string, string>>({});
  const [inputImagesByTask, setInputImagesByTask] = useState<
    Record<string, ImageAttachment[]>
  >({});
  const [agentCommand, setAgentCommand] = useState(getDefaultAgentPlugin().defaultCommand);
  const [agentEnv, setAgentEnv] = useState<Record<string, string>>({});
  const [agentInfoByTask, setAgentInfoByTask] = useState<Record<string, AgentInfoState>>(
    {},
  );
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isConnectedByTask, setIsConnectedByTask] = useState<Record<string, boolean>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null);
  const [agentCapabilitiesByTask, setAgentCapabilitiesByTask] = useState<
    Record<string, any | null>
  >({});
  const [agentMessageLogByTask, setAgentMessageLogByTask] = useState<
    Record<string, string[]>
  >({});
  const showDebug = String(DEBUG || "").toLowerCase() === "true" || DEBUG === "1";

  const [connectionStatusByTask, setConnectionStatusByTask] = useState<
    Record<string, ConnectionStatus>
  >({});

  // Track waiting state per task
  const [waitingByTask, setWaitingByTask] = useState<Record<string, boolean>>({});

  const [theme, setTheme] = useState<"light" | "dark" | "auto">(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return "auto";
    }
    return "light";
  });

  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const effectiveTheme = useMemo(() => {
    if (theme !== "auto") return theme;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }, [theme]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoConnectAttempted = useRef(false);
  const connectInFlight = useRef(false);
  const sessionLoadInFlightByTask = useRef<Record<string, boolean>>({});
  const pendingConnectTaskIdRef = useRef<string | null>(null);
  const tasksRef = useRef<Task[]>([]);
  const activeTaskIdRef = useRef<string | null>(null);
  const isConnectedByTaskRef = useRef<Record<string, boolean>>({});
  const composerRef = useRef<MessageComposer | null>(null);
  const agentTextMsgIdByTaskRef = useRef<Record<string, string | null>>({});
  const agentThoughtMsgIdByTaskRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
  }, [activeTaskId]);

  useEffect(() => {
    isConnectedByTaskRef.current = isConnectedByTask;
  }, [isConnectedByTask]);

  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;
  const defaultAgentInfo = useMemo<AgentInfoState>(
    () => ({
      models: [],
      currentModelId: null,
      commands: [],
      tokenUsage: null,
    }),
    [],
  );
  const activeAgentInfo = useMemo(() => {
    if (!activeTaskId) return defaultAgentInfo;
    const stored = agentInfoByTask[activeTaskId] || defaultAgentInfo;
    return {
      models: stored.models || [],
      commands: stored.commands || [],
      currentModelId: activeTask?.modelId ?? stored.currentModelId ?? null,
      tokenUsage: activeTask?.tokenUsage ?? stored.tokenUsage ?? null,
    };
  }, [
    activeTask?.modelId,
    activeTask?.tokenUsage,
    activeTaskId,
    agentInfoByTask,
    defaultAgentInfo,
  ]);
  const activeAgentCapabilities = activeTaskId
    ? agentCapabilitiesByTask[activeTaskId] ?? null
    : null;
  const activeAgentMessageLog = activeTaskId
    ? agentMessageLogByTask[activeTaskId] ?? []
    : [];
  const inputText = activeTaskId ? inputTextByTask[activeTaskId] ?? "" : "";
  const inputImages = activeTaskId ? inputImagesByTask[activeTaskId] ?? [] : [];
  const activeIsConnected = activeTaskId ? Boolean(isConnectedByTask[activeTaskId]) : false;
  const defaultConnectionStatus = useMemo<ConnectionStatus>(
    () => ({
      state: "disconnected",
      message: "Disconnected",
    }),
    [],
  );
  const activeConnectionStatus = activeTaskId
    ? connectionStatusByTask[activeTaskId] ?? defaultConnectionStatus
    : defaultConnectionStatus;
  const anyConnected = useMemo(
    () => Object.values(isConnectedByTask).some(Boolean),
    [isConnectedByTask],
  );

  // 初始化消息合并器
  useEffect(() => {
    if (activeTask) {
      composerRef.current = new MessageComposer(
        transformMessages(activeTask.messages, activeTaskId || "default"),
      );
    } else {
      composerRef.current = null;
    }
  }, [activeTask, activeTaskId]);

  const persistTaskUpdates = useCallback((taskId: string, updates: Partial<Task>) => {
    window.electron.invoke("db:update-task", taskId, updates);
  }, []);

  const applyTaskUpdates = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      setTasks((prev) => {
        const next = prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
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
    setAgentInfoByTask((prev) => {
      const existing = prev[task.id] || defaultAgentInfo;
      return {
        ...prev,
        [task.id]: {
          ...existing,
          currentModelId: task.modelId ?? existing.currentModelId ?? null,
          tokenUsage: task.tokenUsage ?? existing.tokenUsage ?? null,
        },
      };
    });
  };

  useEffect(() => {
    const effectiveTheme =
      theme === "auto"
        ? window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "auto") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  useEffect(() => {
    // Load wallpaper from settings
    const loadWallpaper = async () => {
      const savedWallpaper = await window.electron.invoke("env:get-wallpaper");
      const normalized = typeof savedWallpaper === "string" ? savedWallpaper.trim() : "";
      setWallpaper(normalized ? normalized : null);
    };
    loadWallpaper();
  }, []);

  useEffect(() => {
    // Apply wallpaper
    const root = document.documentElement;
    if (wallpaper) {
      // 检查是否是渐变背景
      if (isWallpaperGradient(wallpaper)) {
        root.style.setProperty("--wallpaper", wallpaper);
      } else {
        // 否则假设是图片文件
        root.style.setProperty("--wallpaper", `url('${wallpaperUrl(wallpaper)}')`);
      }
      root.classList.add("bg-wallpaper");
    } else {
      root.style.removeProperty("--wallpaper");
      root.classList.remove("bg-wallpaper");
    }
  }, [wallpaper]);

  const handleWallpaperChange = async (path: string | null) => {
    const normalized = typeof path === "string" ? path.trim() : "";
    setWallpaper(normalized ? normalized : null);
    if (normalized) {
      await window.electron.invoke("env:set-wallpaper", normalized);
    } else {
      await window.electron.invoke("env:clear-wallpaper");
    }
  };

  const setThemeMode = (newTheme: "light" | "dark" | "auto") => {
    setTheme(newTheme);
  };

  const handlePermissionResponse = useCallback(
    async (permissionId: string, optionId: string | null) => {
      const response = optionId
        ? { outcome: { outcome: "selected", optionId } }
        : { outcome: { outcome: "cancelled" } };
      await window.electron.invoke("agent:permission-response", permissionId, response);
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
    if (!task?.modelId && activeAgentInfo.currentModelId) {
      applyTaskUpdates(activeTaskId, {
        modelId: activeAgentInfo.currentModelId,
        updatedAt: Date.now(),
      });
    }
  }, [activeAgentInfo.currentModelId, activeTaskId, applyTaskUpdates, tasks]);

  useEffect(() => {
    if (!activeTaskId) {
      return;
    }
    if (!activeIsConnected) {
      setAgentCapabilitiesByTask((prev) => ({ ...prev, [activeTaskId]: null }));
      return;
    }
    if (window.electron) {
      window.electron
        .invoke("agent:get-capabilities")
        .then((caps) =>
          setAgentCapabilitiesByTask((prev) => ({ ...prev, [activeTaskId]: caps })),
        )
        .catch(() => setAgentCapabilitiesByTask((prev) => ({ ...prev, [activeTaskId]: null })));
    }
  }, [activeIsConnected, activeTaskId]);

  useEffect(() => {
    if (!activeTaskId && Object.keys(agentMessageLogByTask).length > 0) {
      setAgentMessageLogByTask({});
    }
  }, [activeTaskId, agentMessageLogByTask]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const setCurrentInputText = useCallback(
    (value: string) => {
      if (!activeTaskId) return;
      setInputTextByTask((prev) => ({ ...prev, [activeTaskId]: value }));
    },
    [activeTaskId],
  );

  const setCurrentInputImages = useCallback(
    (images: ImageAttachment[]) => {
      if (!activeTaskId) return;
      setInputImagesByTask((prev) => ({ ...prev, [activeTaskId]: images }));
    },
    [activeTaskId],
  );

  const appendCurrentInputImages = useCallback(
    (images: ImageAttachment[]) => {
      if (!activeTaskId) return;
      setInputImagesByTask((prev) => {
        const existing = prev[activeTaskId] ?? [];
        return { ...prev, [activeTaskId]: [...existing, ...images] };
      });
    },
    [activeTaskId],
  );

  const setTaskConnected = useCallback((taskId: string, connected: boolean) => {
    setIsConnectedByTask((prev) => {
      const isConnected = Boolean(prev[taskId]);
      if (isConnected === connected) return prev;
      const next = { ...prev };
      if (connected) {
        next[taskId] = true;
      } else {
        delete next[taskId];
      }
      return next;
    });
  }, []);

  const setTaskConnectionStatus = useCallback(
    (taskId: string, status: ConnectionStatus) => {
      setConnectionStatusByTask((prev) => {
        const existing = prev[taskId];
        if (existing?.state === status.state && existing?.message === status.message) {
          return prev;
        }
        return { ...prev, [taskId]: status };
      });
    },
    [],
  );

  const clearTaskState = useCallback((taskId: string) => {
    setInputTextByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setInputImagesByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setWaitingByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setAgentInfoByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setAgentCapabilitiesByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setAgentMessageLogByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setIsConnectedByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setConnectionStatusByTask((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    delete sessionLoadInFlightByTask.current[taskId];
    delete agentTextMsgIdByTaskRef.current[taskId];
    delete agentThoughtMsgIdByTaskRef.current[taskId];
    if (pendingConnectTaskIdRef.current === taskId) {
      pendingConnectTaskIdRef.current = null;
    }
  }, []);

  const setTaskWaiting = useCallback((taskId: string, waiting: boolean) => {
    setWaitingByTask((prev) => {
      const isWaiting = Boolean(prev[taskId]);
      if (isWaiting === waiting) return prev;
      const next = { ...prev };
      if (waiting) {
        next[taskId] = true;
      } else {
        delete next[taskId];
      }
      return next;
    });
  }, []);

  const handleIncomingMessage = useCallback(
    (data: IncomingMessage) => {
      const tasksSnapshot = tasksRef.current;
      const activeTaskIdSnapshot = activeTaskIdRef.current;
      const activeTaskSnapshot =
        tasksSnapshot.find((task) => task.id === activeTaskIdSnapshot) ?? null;
      const resolveTaskId = (list: Task[]) => {
        if (data.sessionId) {
          const match = list.find((task) => task.sessionId === data.sessionId);
          return match?.id ?? activeTaskIdSnapshot;
        }
        return activeTaskIdSnapshot;
      };
      const resolvedTaskIdSnapshot = resolveTaskId(tasksSnapshot);

      // Clear waiting state only for the task that owns this message
      if (
        data.type === "agent_text" ||
        data.type === "agent_thought" ||
        data.type === "tool_call" ||
        data.type === "tool_call_update"
      ) {
        if (resolvedTaskIdSnapshot) {
          setTaskWaiting(resolvedTaskIdSnapshot, false);
        }
      }

      if (
        !activeTaskIdSnapshot &&
        !data.sessionId &&
        data.type !== "system" &&
        data.type !== "agent_info" &&
        data.type !== "permission_request"
      ) {
        return;
      }
      if (data.type === "agent_info") {
        const resolvedTaskId = data.sessionId
          ? (tasksSnapshot.find((task) => task.sessionId === data.sessionId)?.id ??
            activeTaskIdSnapshot)
          : activeTaskIdSnapshot;
        const nextUsage = data.info?.tokenUsage ?? null;
        const baseUsage = activeTaskSnapshot?.tokenUsage ?? null;
        const mergedUsage = nextUsage
          ? {
              promptTokens: (baseUsage?.promptTokens ?? 0) + (nextUsage.promptTokens ?? 0),
              completionTokens:
                (baseUsage?.completionTokens ?? 0) + (nextUsage.completionTokens ?? 0),
              totalTokens: (baseUsage?.totalTokens ?? 0) + (nextUsage.totalTokens ?? 0),
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
        if (resolvedTaskId) {
          setAgentInfoByTask((prev) => {
            const existing = prev[resolvedTaskId] || defaultAgentInfo;
            return {
              ...prev,
              [resolvedTaskId]: {
                models: data.info?.models ?? existing.models,
                currentModelId: data.info?.currentModelId ?? existing.currentModelId,
                commands: data.info?.commands ?? existing.commands,
                tokenUsage: mergedUsage,
              },
            };
          });
        }
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
        if (content.includes("Agent disconnected") || content.includes("Agent process error")) {
          const message = content.replace(/^System:\s*/, "");
          setIsConnectedByTask({});
          setWaitingByTask({});
          setAgentInfoByTask({});
          setAgentCapabilitiesByTask({});
          clearAllSessionIds();
          sessionLoadInFlightByTask.current = {};
          pendingConnectTaskIdRef.current = null;
          setConnectionStatusByTask(() => {
            const next: Record<string, ConnectionStatus> = {};
            tasksSnapshot.forEach((task) => {
              next[task.id] = { state: "error", message };
            });
            return next;
          });
          return;
        }
        const resolvedTaskId = resolveTaskId(tasksSnapshot);
        const targetTask = resolvedTaskId
          ? tasksSnapshot.find((task) => task.id === resolvedTaskId)
          : null;
        if (resolvedTaskId) {
          const updatedAt = Date.now();
          applyTaskUpdates(resolvedTaskId, {
            messages: [
              ...(targetTask?.messages ?? []),
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
        const resolvedTaskId = resolveTaskId(tasksSnapshot) ?? tasksSnapshot[0]?.id ?? null;
        const targetTask = resolvedTaskId
          ? tasksSnapshot.find((task) => task.id === resolvedTaskId)
          : null;
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
              ...(targetTask?.messages ?? []),
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
        resolvedTaskIdSnapshot &&
        sessionLoadInFlightByTask.current[resolvedTaskIdSnapshot] &&
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
        if (!resolvedTaskId) return prev;
        const targetTask = resolvedTaskId ? prev.find((task) => task.id === resolvedTaskId) : null;
        if (!targetTask) return prev;

        let msgId: string | undefined;
        if (data.type === "agent_text") {
          if (!agentTextMsgIdByTaskRef.current[resolvedTaskId]) {
            agentTextMsgIdByTaskRef.current[resolvedTaskId] = Date.now().toString();
          }
          msgId = agentTextMsgIdByTaskRef.current[resolvedTaskId] ?? undefined;
        } else if (data.type === "agent_thought") {
          if (!agentThoughtMsgIdByTaskRef.current[resolvedTaskId]) {
            agentThoughtMsgIdByTaskRef.current[resolvedTaskId] = Date.now().toString();
          }
          msgId = agentThoughtMsgIdByTaskRef.current[resolvedTaskId] ?? undefined;
        }

        const newMessage = transformIncomingMessage(data, resolvedTaskId, {
          msgId,
        });
        const composer = new MessageComposer(
          transformMessages(targetTask.messages, resolvedTaskId),
        );
        composer.addMessage(newMessage);
        const updatedMessages = composer.getMessages();

        // Convert back to legacy message shape for storage/rendering.
        const oldFormatMessages = transformToLegacyMessages(updatedMessages, targetTask.messages);

        const updatedAt = Date.now();
        if (resolvedTaskId) {
          persistTaskUpdates(resolvedTaskId, {
            messages: oldFormatMessages,
            updatedAt,
            lastActiveAt: updatedAt,
          });
        }
        return prev.map((task) =>
          task.id === resolvedTaskId
            ? {
                ...task,
                messages: oldFormatMessages,
                updatedAt,
                lastActiveAt: updatedAt,
              }
            : task,
        );
      });

      setTimeout(scrollToBottom, 100);
    },
    [
      applyTaskUpdates,
      clearAllSessionIds,
      defaultAgentInfo,
      scrollToBottom,
      setAgentInfoByTask,
      setTaskConnected,
      setTaskConnectionStatus,
      setTaskWaiting,
    ],
  );

  useEffect(() => {
    // Listen for agent messages
    if (!window.electron) {
      return;
    }
    const removeListener = window.electron.on("agent:message", (msg: IncomingMessage | string) => {
      const data: IncomingMessage =
        typeof msg === "string" ? { type: "agent_text", text: msg } : msg;
      console.log("[agent:message]", data);
      const resolvedTaskId = data.sessionId
        ? tasksRef.current.find((task) => task.sessionId === data.sessionId)?.id ??
          activeTaskIdRef.current
        : activeTaskIdRef.current;
      if (resolvedTaskId) {
        setAgentMessageLogByTask((prev) => {
          const existing = prev[resolvedTaskId] ?? [];
          const next = [
            `[${new Date().toISOString()}] ${JSON.stringify(data)}`,
            ...existing,
          ];
          return { ...prev, [resolvedTaskId]: next.slice(0, 50) };
        });
      }
      handleIncomingMessage(data);
    });

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

      const resolvedActiveId = loadedTasks.find((task) => task.id === storedActiveTaskId)
        ? storedActiveTaskId
        : (loadedTasks[0]?.id ?? null);

      if (resolvedActiveId) {
        setActiveTaskId(resolvedActiveId);
        const nextTask = loadedTasks.find((task) => task.id === resolvedActiveId);
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
    sessionLoadInFlightByTask.current[task.id] = false;
    setTaskConnectionStatus(task.id, {
      state: "connecting",
      message: `Connecting to: ${task.agentCommand}...`,
    });

    connectInFlight.current = true;
    try {
      const commandName = task.agentCommand.trim().split(" ")[0];
      if (!commandName) {
        setTaskConnectionStatus(task.id, {
          state: "error",
          message: "Agent command is empty.",
        });
        return null;
      }
      if (!commandName.includes("/") && !commandName.startsWith(".")) {
        const check = await window.electron.invoke("agent:check-command", commandName);
        if (!check.installed) {
          setTaskConnectionStatus(task.id, {
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
        setTaskConnectionStatus(task.id, {
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
          await window.electron.invoke("agent:set-active-session", sessionId, task.workspace);
        } catch {
          sessionId = null;
        }
      } else if (task.sessionId && (canResume || canLoad)) {
        try {
          if (canResume) {
            await window.electron.invoke("agent:resume-session", task.sessionId, task.workspace);
            sessionId = task.sessionId;
            applyTaskUpdates(task.id, {
              updatedAt: Date.now(),
              lastActiveAt: Date.now(),
            });
          } else if (canLoad) {
            sessionLoadInFlightByTask.current[task.id] = true;
            await window.electron.invoke("agent:load-session", task.sessionId, task.workspace);
            sessionId = task.sessionId;
            applyTaskUpdates(task.id, {
              updatedAt: Date.now(),
              lastActiveAt: Date.now(),
            });
            sessionLoadInFlightByTask.current[task.id] = false;
          }
        } catch {
          sessionId = null;
          sessionLoadInFlightByTask.current[task.id] = false;
        }
      }

      if (!sessionId) {
        const sessionResult = await window.electron.invoke("agent:new-session", task.workspace);
        sessionId = sessionResult.sessionId;
        applyTaskUpdates(task.id, {
          sessionId,
          updatedAt: Date.now(),
          lastActiveAt: Date.now(),
        });
      }

      setTaskConnected(task.id, true);
      setTaskConnectionStatus(task.id, {
        state: "connected",
        message: "Connected.",
      });

      if (task.modelId) {
        await window.electron.invoke("agent:set-model", task.modelId);
      }

      return sessionId;
    } catch (e: any) {
      setTaskConnected(task.id, false);
      setTaskConnectionStatus(task.id, {
        state: "error",
        message: `Connection failed: ${e.message}`,
      });
      return null;
    } finally {
      connectInFlight.current = false;
      const pendingTaskId = pendingConnectTaskIdRef.current;
      if (pendingTaskId && pendingTaskId === activeTaskIdRef.current) {
        pendingConnectTaskIdRef.current = null;
        const pendingTask = tasksRef.current.find((entry) => entry.id === pendingTaskId);
        if (pendingTask && !isConnectedByTaskRef.current[pendingTaskId]) {
          ensureTaskSession(pendingTask);
        }
      }
    }
  };

  useEffect(() => {
    if (!activeTask || activeIsConnected) {
      return;
    }
    if (connectInFlight.current) {
      pendingConnectTaskIdRef.current = activeTask.id;
      setTaskConnectionStatus(activeTask.id, {
        state: "connecting",
        message: "Queued to connect...",
      });
      return;
    }
    // removed hardcoded qwen check
    ensureTaskSession(activeTask);
  }, [activeIsConnected, activeTask]);

  const handleConnect = async () => {
    if (connectInFlight.current) {
      return;
    }
    if (activeIsConnected) {
      await window.electron.invoke("agent:disconnect");
      setIsConnectedByTask({});
      setConnectionStatusByTask({});
      setWaitingByTask({});
      setAgentInfoByTask({});
      setAgentCapabilitiesByTask({});
      setAgentMessageLogByTask({});
      clearAllSessionIds();
      sessionLoadInFlightByTask.current = {};
      agentTextMsgIdByTaskRef.current = {};
      agentThoughtMsgIdByTaskRef.current = {};
      pendingConnectTaskIdRef.current = null;
      return;
    }
    if (!activeTask) {
      return;
    }
    setTaskConnectionStatus(activeTask.id, {
      state: "connecting",
      message: `Connecting to: ${activeTask.agentCommand}...`,
    });
    await ensureTaskSession(activeTask);
    setIsSettingsOpen(false);
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
    setActiveTaskId(taskId);
    syncActiveTaskState(task);

    if (connectInFlight.current) {
      pendingConnectTaskIdRef.current = task.id;
      setTaskConnectionStatus(task.id, {
        state: "connecting",
        message: "Queued to connect...",
      });
      return;
    }

    // 检查任务是否有会话ID，如果有且已经连接，则不重新连接
    if (anyConnected && task.sessionId) {
      try {
        await window.electron.invoke("agent:set-active-session", task.sessionId, task.workspace);
        // 当切换任务时，同时更新模型到该任务的模型
        if (task.modelId) {
          await window.electron.invoke("agent:set-model", task.modelId);
        }
        setTaskConnected(task.id, true);
        setTaskConnectionStatus(task.id, {
          state: "connected",
          message: "Connected.",
        });
        return;
      } catch (e: any) {
        console.error("Failed to set active session:", e);
      }
    }

    // 只有在没有连接或会话ID无效时才重新连接
    await ensureTaskSession(task);
  };

  const handleRenameTask = (taskId: string, newTitle: string) => {
    applyTaskUpdates(taskId, { title: newTitle, updatedAt: Date.now() });
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = window.confirm("Delete this task? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    const nextTasks = tasks.filter((task) => task.id !== taskId);
    setTasks(nextTasks);
    await window.electron.invoke("db:delete-task", taskId);
    clearTaskState(taskId);

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
      setIsConnectedByTask({});
      setConnectionStatusByTask({});
      clearAllSessionIds();
      sessionLoadInFlightByTask.current = {};
      pendingConnectTaskIdRef.current = null;
      await window.electron.invoke("agent:disconnect");
    }
  };

  const handleStop = async () => {
    try {
      await window.electron.invoke("agent:stop");
      if (activeTaskId) {
        setTaskWaiting(activeTaskId, false);
      } else {
        setWaitingByTask({});
      }
    } catch (e: any) {
      console.error("Stop error:", e);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && inputImages.length === 0) return;
    if (!activeIsConnected) {
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

    sessionLoadInFlightByTask.current[activeTaskId] = false;

    const text = inputText;
    const images = [...inputImages];
    setInputTextByTask((prev) => ({ ...prev, [activeTaskId]: "" }));
    setInputImagesByTask((prev) => ({ ...prev, [activeTaskId]: [] }));

    if (activeTaskId) {
      const nextMessages = [
        ...(activeTask?.messages ?? []),
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
    if (activeTaskId) {
      setTaskWaiting(activeTaskId, true);
    }
    agentTextMsgIdByTaskRef.current[activeTaskId] = null;
    agentThoughtMsgIdByTaskRef.current[activeTaskId] = null;

    try {
      await window.electron.invoke("agent:send", text, images);
    } catch (e: any) {
      if (activeTaskId) {
        setTaskWaiting(activeTaskId, false);
      }
      handleIncomingMessage({
        type: "system",
        text: `Send error: ${e.message}`,
      });
    }
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
      if (activeTaskId) {
        setAgentInfoByTask((prev) => {
          const existing = prev[activeTaskId] || defaultAgentInfo;
          return {
            ...prev,
            [activeTaskId]: {
              ...existing,
              currentModelId: modelId,
            },
          };
        });
      }
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
        const versionMatch = result.node.version?.match(/^v?(\d+)/);
        const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;
        const nodeOk = result.node.installed && majorVersion >= 18;
        setEnvReady(nodeOk);
        if (!result.npm.installed) {
          console.warn("[Env] npm not detected; agent installs may fail.");
        }
      } catch {
        setEnvReady(false);
      }
    };
    checkEnv();
  }, []);

  const renderMessages = useMemo(() => {
    if (!activeTask) return [];
    return transformMessages(activeTask.messages, activeTaskId || "default");
  }, [activeTask, activeTaskId]);
  const isWaitingForResponse = activeTaskId ? Boolean(waitingByTask[activeTaskId]) : false;

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
          effectiveTheme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#f97316",
        },
      }}
    >
      <div className="relative h-screen w-screen overflow-hidden bg-surface">
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          agentCommand={agentCommand}
          onAgentCommandChange={handleAgentCommandChange}
          agentEnv={agentEnv}
          onAgentEnvChange={handleAgentEnvChange}
          isConnected={activeIsConnected}
          onConnectToggle={handleConnect}
          wallpaper={wallpaper}
          onWallpaperChange={handleWallpaperChange}
          theme={theme}
          onThemeChange={setThemeMode}
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
          onThemeChange={setThemeMode}
        />

        {/* Main Chat Area */}
        <main className="ml-[280px] flex h-full flex-col bg-surface-cream">
          <ChatHeader
            connectionStatus={activeConnectionStatus}
            currentWorkspace={currentWorkspace}
            models={activeAgentInfo.models}
            currentModelId={activeAgentInfo.currentModelId}
            isModelMenuOpen={isModelMenuOpen}
            onToggleModelMenu={() => setIsModelMenuOpen((prev) => !prev)}
            onModelPick={handleModelPick}
            title={activeTask?.title || "Agent Cowork"}
            showDebug={showDebug}
            agentInfo={activeAgentInfo}
            agentCapabilities={activeAgentCapabilities}
            agentMessageLog={activeAgentMessageLog}
          />

          <div className="flex-1 overflow-y-auto bg-surface-cream">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 pb-28 pt-5">
              {/* Welcome / Empty State */}
              {renderMessages.length === 0 ? (
                <div className="text-center text-muted mt-10">
                  <div className="mb-2">Beginning of conversation</div>
                  <div className="mx-auto h-px w-10 bg-ink-900/10" />
                </div>
              ) : null}

              {renderMessages.map((msg) => (
                <MessageRenderer
                  key={msg.id}
                  msg={msg}
                  onPermissionResponse={handlePermissionResponse}
                />
              ))}

              {/* Loading message bubble */}
              {isWaitingForResponse && (
                <MessageRenderer
                  msg={{
                    id: "loading",
                    conversation_id: activeTaskId || "default",
                    type: "thought",
                    content: {
                      thought: "Thinking...",
                    },
                    position: "left",
                  }}
                  isLoading
                  onStop={handleStop}
                />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <SendBox
            value={inputText}
            onChange={setCurrentInputText}
            loading={isWaitingForResponse}
            placeholder="Describe what you want agent to handle... (paste images to include)"
            onStop={handleStop}
            onFilesAdded={(files) => {
              const newImages: ImageAttachment[] = [];
              files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  newImages.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                    filename: file.name,
                    mimeType: file.type,
                    dataUrl: e.target?.result as string,
                    size: file.size,
                  });
                  if (newImages.length === files.length) {
                    appendCurrentInputImages(newImages);
                  }
                };
                reader.readAsDataURL(file);
              });
            }}
            supportedExts={["image/png", "image/jpeg", "image/webp"]}
            onSend={handleSend}
            images={inputImages}
            onImagesChange={setCurrentInputImages}
          />
        </main>
      </div>
    </ConfigProvider>
  );
};

export default App;
