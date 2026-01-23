import { Send } from "lucide-react";
import { useRef, useEffect } from "react";
import type { AgentCommandInfo } from "../types";

interface ChatInputProps {
  inputText: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isConnected: boolean;
  isCommandMenuOpen: boolean;
  filteredCommands: AgentCommandInfo[];
  commandSelectedIndex: number;
  onCommandPick: (cmd: AgentCommandInfo) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export const ChatInput = ({
  inputText,
  onInputChange,
  onSend,
  isConnected,
  isCommandMenuOpen,
  filteredCommands,
  commandSelectedIndex,
  onCommandPick,
  onKeyDown,
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  return (
    <div className="input-container">
      <div className="input-box">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe what you want agent to handle..."
          rows={1}
          disabled={!isConnected}
        />
        <button
          type="button"
          className="send-button"
          onClick={onSend}
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
                  onClick={() => onCommandPick(cmd)}
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
  );
};
