import { ChevronDown } from "lucide-react";
import type { AgentModelInfo, ConnectionStatus } from "../types";

interface ChatHeaderProps {
  connectionStatus: ConnectionStatus;
  currentWorkspace: string | null;
  models: AgentModelInfo[];
  currentModelId: string | null;
  isModelMenuOpen: boolean;
  onToggleModelMenu: () => void;
  onModelPick: (modelId: string) => void;
  showDebug?: boolean;
  agentInfo?: any;
  agentCapabilities?: any;
  agentMessageLog?: string[];
}

export const ChatHeader = ({
  connectionStatus,
  currentWorkspace,
  models,
  currentModelId,
  isModelMenuOpen,
  onToggleModelMenu,
  onModelPick,
  showDebug,
  agentInfo,
  agentCapabilities,
  agentMessageLog,
}: ChatHeaderProps) => {
  const currentModel = models.find((model) => model.modelId === currentModelId);

  return (
    <>
      <div className="px-6 h-14 flex items-center justify-between bg-app border-b border-color z-10">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 text-sm text-text-secondary py-1 ${
              connectionStatus.state
            }`}
            title={`Status: ${connectionStatus.state}`}
          >
            <div className="relative flex items-center justify-center w-3 h-3">
              <div
                className={`w-2 h-2 rounded-full z-2 transition-all ${
                  connectionStatus.state === "connected"
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94.0.6),0_0_4px_rgba(34,197,94,0.8)_inset] animate-pulse-green"
                    : connectionStatus.state === "connecting"
                      ? "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] animate-pulse-orange"
                      : connectionStatus.state === "error"
                        ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse-red"
                        : "bg-slate-400"
                }`}
              />
              {connectionStatus.state === "connected" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full opacity-0 z-1 pointer-events-none bg-green-500/30 animate-ripple-green" />
              )}
              {connectionStatus.state === "connecting" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full opacity-0 z-1 pointer-events-none bg-orange-500/40 animate-ripple-orange" />
              )}
            </div>
            <span className="font-medium">
              {connectionStatus.state === "connected"
                ? "System Connected"
                : connectionStatus.state === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
            </span>
          </div>

          {currentWorkspace && (
            <>
              <div className="w-px h-4 bg-color" />
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="opacity-70">📂</span>
                <span className="font-mono font-medium text-text-primary" title={currentWorkspace}>
                  {currentWorkspace.split("/").pop()}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {models.length > 0 && (
            <div className="relative inline-flex flex-col gap-1.5">
              <button
                type="button"
                className="border border-color bg-surface transition-all py-1.5 px-3 rounded-md flex items-center justify-between gap-2 cursor-pointer font-medium text-text-primary min-w-[140px] text-sm hover:bg-surface-hover hover:border-hover"
                onClick={onToggleModelMenu}
              >
                <span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {currentModel?.name || currentModelId || "Unknown"}
                </span>
                <ChevronDown size={14} className="text-text-tertiary" />
              </button>
              {isModelMenuOpen && (
                <div className="absolute top-[calc(100%+6px)] right-0 w-60 bg-surface border border-color shadow-lg rounded-xl z-50 p-1 max-h-72 overflow-y-auto">
                  {models.map((model) => (
                    <button
                      key={model.modelId}
                      type="button"
                      className={`w-full p-2 flex flex-col gap-0.5 border-none text-left bg-none cursor-pointer rounded)md ${
                        model.modelId === currentModelId ? "active" : ""
                      } hover:bg-surface-hover`}
                      onClick={() => onModelPick(model.modelId)}
                    >
                      <span className="font-semibold text-text-primary text-sm">{model.name}</span>
                      <span className="text-text-secondary text-xs">
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

      {showDebug && (
        <div className="text-xs text-text-secondary bg-surface-muted border border-color border-t-0 px-6 py-3 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto border-b border-color">
          {`agentInfo=${JSON.stringify(agentInfo, null, 2)}\nagentCapabilities=${JSON.stringify(
            agentCapabilities,
            null,
            2,
          )}\nagentMessageLog=${JSON.stringify(agentMessageLog, null, 2)}`}
        </div>
      )}
    </>
  );
};
