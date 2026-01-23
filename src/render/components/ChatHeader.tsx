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
}

export const ChatHeader = ({
  connectionStatus,
  currentWorkspace,
  models,
  currentModelId,
  isModelMenuOpen,
  onToggleModelMenu,
  onModelPick,
}: ChatHeaderProps) => {
  const currentModel = models.find((model) => model.modelId === currentModelId);

  return (
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
        {models.length > 0 && (
          <div className="model-selector">
            <button
              type="button"
              className="model-selector-trigger"
              onClick={onToggleModelMenu}
            >
              <span className="model-current-name">
                {currentModel?.name || currentModelId || "Unknown"}
              </span>
              <ChevronDown size={14} className="model-arrow" />
            </button>
            {isModelMenuOpen && (
              <div className="model-dropdown">
                {models.map((model) => (
                  <button
                    key={model.modelId}
                    type="button"
                    className={`model-item ${
                      model.modelId === currentModelId ? "active" : ""
                    }`}
                    onClick={() => onModelPick(model.modelId)}
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
  );
};
