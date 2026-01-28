import { Check, ChevronDown } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { AgentIcon } from "../../agents/AgentIcon";
import { AGENT_PLUGINS, getAgentPlugin } from "../../agents/registry";
import { useClickOutside } from "../../hooks";

interface AgentSelectorProps {
  selectedPluginId: string;
  onPluginChange: (pluginId: string) => void;
  pluginInstallStatuses: Record<string, string>;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  selectedPluginId,
  onPluginChange,
  pluginInstallStatuses,
}) => {
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsAgentDropdownOpen(false));

  const selectedPlugin = getAgentPlugin(selectedPluginId);

  return (
    <div className="settings-agent-selector">
      <label className="modal-label">Select Agent to Configure</label>
      <div className="custom-select-container" ref={dropdownRef}>
        <button
          type="button"
          className="custom-select-trigger"
          onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {selectedPlugin?.icon && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <AgentIcon icon={selectedPlugin.icon} size={16} />
              </span>
            )}
            {selectedPlugin ? selectedPlugin.name : "Custom Agent"}
          </span>
          <ChevronDown
            size={16}
            className={`select-arrow ${isAgentDropdownOpen ? "open" : ""}`}
          />
        </button>

        {isAgentDropdownOpen && (
          <div className="custom-select-dropdown">
            <button
              type="button"
              className={`custom-select-option ${selectedPluginId === "custom" ? "selected" : ""}`}
              onClick={() => {
                onPluginChange("custom");
                setIsAgentDropdownOpen(false);
              }}
            >
              Custom Agent
              {selectedPluginId === "custom" && <Check size={14} />}
            </button>
            {AGENT_PLUGINS.map((plugin) => (
              <button
                key={plugin.id}
                type="button"
                className={`custom-select-option ${selectedPluginId === plugin.id ? "selected" : ""}`}
                onClick={() => {
                  onPluginChange(plugin.id);
                  setIsAgentDropdownOpen(false);
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {plugin.icon && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <AgentIcon icon={plugin.icon} size={16} />
                    </span>
                  )}
                  {plugin.name}
                  {pluginInstallStatuses[plugin.id] === "installed" && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      (已安装)
                    </span>
                  )}
                  {pluginInstallStatuses[plugin.id] === "not-installed" && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--error)",
                      }}
                    >
                      (未安装)
                    </span>
                  )}
                </div>
                {selectedPluginId === plugin.id && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
