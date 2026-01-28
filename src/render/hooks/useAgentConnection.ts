import { useCallback, useRef, useState } from "react";
import type { AgentInfoState, ConnectionStatus, Task } from "../types";

export function useAgentConnection() {
  const [isConnectedByTask, setIsConnectedByTask] = useState<Record<string, boolean>>({});
  const [connectionStatusByTask, setConnectionStatusByTask] = useState<
    Record<string, ConnectionStatus>
  >({});
  const [agentInfoByTask, setAgentInfoByTask] = useState<Record<string, AgentInfoState>>({});
  const [agentCapabilitiesByTask, setAgentCapabilitiesByTask] = useState<
    Record<string, any | null>
  >({});
  const [agentMessageLogByTask, setAgentMessageLogByTask] = useState<Record<string, string[]>>({});

  const isConnectedByTaskRef = useRef<Record<string, boolean>>({});
  const connectInFlightByTask = useRef<Record<string, boolean>>({});
  const sessionLoadInFlightByTask = useRef<Record<string, boolean>>({});
  const pendingConnectByTaskRef = useRef<Record<string, boolean>>({});
  const agentTextMsgIdByTaskRef = useRef<Record<string, string | null>>({});
  const agentThoughtMsgIdByTaskRef = useRef<Record<string, string | null>>({});

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

  const setTaskConnectionStatus = useCallback((taskId: string, status: ConnectionStatus) => {
    setConnectionStatusByTask((prev) => {
      const existing = prev[taskId];
      if (existing?.state === status.state && existing?.message === status.message) {
        return prev;
      }
      return { ...prev, [taskId]: status };
    });
  }, []);

  const clearTaskConnectionState = useCallback((taskId: string) => {
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
    delete sessionLoadInFlightByTask.current[taskId];
    delete agentTextMsgIdByTaskRef.current[taskId];
    delete agentThoughtMsgIdByTaskRef.current[taskId];
    delete pendingConnectByTaskRef.current[taskId];
    delete connectInFlightByTask.current[taskId];
  }, []);

  return {
    isConnectedByTask,
    setIsConnectedByTask,
    connectionStatusByTask,
    setConnectionStatusByTask,
    agentInfoByTask,
    setAgentInfoByTask,
    agentCapabilitiesByTask,
    setAgentCapabilitiesByTask,
    agentMessageLogByTask,
    setAgentMessageLogByTask,
    isConnectedByTaskRef,
    connectInFlightByTask,
    sessionLoadInFlightByTask,
    pendingConnectByTaskRef,
    agentTextMsgIdByTaskRef,
    agentThoughtMsgIdByTaskRef,
    setTaskConnected,
    setTaskConnectionStatus,
    clearTaskConnectionState,
  };
}
