import { Plus, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";

interface EnvVariablesProps {
  agentEnv: Record<string, string>;
  onAgentEnvChange: (env: Record<string, string>) => void;
}

export const EnvVariables: React.FC<EnvVariablesProps> = ({ agentEnv, onAgentEnvChange }) => {
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvVal, setNewEnvVal] = useState("");

  const addEnvVar = useCallback(() => {
    if (newEnvKey.trim()) {
      onAgentEnvChange({ ...agentEnv, [newEnvKey.trim()]: newEnvVal });
      setNewEnvKey("");
      setNewEnvVal("");
    }
  }, [newEnvKey, newEnvVal, agentEnv, onAgentEnvChange]);

  const removeEnvVar = useCallback(
    (key: string) => {
      const next = { ...agentEnv };
      delete next[key];
      onAgentEnvChange(next);
    },
    [agentEnv, onAgentEnvChange],
  );

  return (
    <div className="modal-section">
      <label className="modal-label">Environment Variables</label>
      <div className="env-list">
        {Object.entries(agentEnv).map(([key, val]) => (
          <div key={key} className="env-row">
            <input readOnly value={key} className="env-input key" />
            <input readOnly value={val} type="password" className="env-input val" />
            <button type="button" onClick={() => removeEnvVar(key)} className="btn-icon danger">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="env-row">
          <input
            placeholder="KEY"
            value={newEnvKey}
            onChange={(e) => setNewEnvKey(e.target.value)}
            className="env-input key"
          />
          <input
            placeholder="VALUE"
            value={newEnvVal}
            onChange={(e) => setNewEnvVal(e.target.value)}
            className="env-input val"
          />
          <button
            type="button"
            onClick={addEnvVar}
            disabled={!newEnvKey.trim()}
            className={`btn-icon ${newEnvKey.trim() ? "success" : ""}`}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
