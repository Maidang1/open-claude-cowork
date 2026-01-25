import type { CSSProperties } from "react";
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
  title?: string;
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
  title,
  showDebug,
  agentInfo,
  agentCapabilities,
  agentMessageLog,
}: ChatHeaderProps) => {
  const currentModel = models.find((model) => model.modelId === currentModelId);
  const dragStyle = { WebkitAppRegion: "drag" } as CSSProperties;
  const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

  return (
    <>
      <div className="group relative flex h-12 items-center justify-between border-b border-ink-900/10 bg-surface-cream px-6 z-10">
        <div className="flex items-center gap-3 text-xs text-ink-600 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
          <div className="flex items-center gap-2" title={`Status: ${connectionStatus.state}`}>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connectionStatus.state === "connected"
                  ? "bg-success"
                  : connectionStatus.state === "connecting"
                    ? "bg-accent"
                    : connectionStatus.state === "error"
                      ? "bg-error"
                      : "bg-ink-400"
              }`}
            />
            <span>
              {connectionStatus.state === "connected"
                ? "Connected"
                : connectionStatus.state === "connecting"
                  ? "Connecting"
                  : "Disconnected"}
            </span>
          </div>
          {currentWorkspace && (
            <div className="flex items-center gap-2 text-xs text-ink-600">
              <span className="text-ink-400">/</span>
              <span className="font-mono text-ink-700" title={currentWorkspace}>
                {currentWorkspace.split("/").pop()}
              </span>
            </div>
          )}
        </div>

        <div
          className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-ink-700 select-none"
          style={dragStyle}
        >
          {title || "Agent Cowork"}
        </div>
        <div className="pointer-events-none absolute right-6 flex items-center gap-1 text-ink-400/60 opacity-100 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </div>

        <div
          className="flex items-center gap-3 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
          style={noDragStyle}
        >
          {models.length > 0 && (
            <div className="relative inline-flex flex-col gap-1.5">
              <button
                type="button"
                className="flex items-center justify-between gap-2 rounded-xl border border-ink-900/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-surface-tertiary hover:border-ink-900/20"
                onClick={onToggleModelMenu}
              >
                <span className="max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {currentModel?.name || currentModelId || "Unknown"}
                </span>
                <ChevronDown size={12} className="text-ink-500" />
              </button>
              {isModelMenuOpen && (
                <div className="absolute top-[calc(100%+6px)] right-0 w-60 rounded-xl border border-ink-900/10 bg-surface p-1 shadow-card z-50 max-h-72 overflow-y-auto">
                  {models.map((model) => (
                    <button
                      key={model.modelId}
                      type="button"
                      className={`w-full rounded-lg px-3 py-2 text-left transition hover:bg-ink-900/5 ${
                        model.modelId === currentModelId ? "bg-accent/10 text-ink-800" : "text-ink-700"
                      }`}
                      onClick={() => onModelPick(model.modelId)}
                    >
                      <span className="block text-sm font-semibold">{model.name}</span>
                      <span className="block text-xs text-ink-500">
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
