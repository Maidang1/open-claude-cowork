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
    <div className="py-6 pb-8 bg-gradient-to-t from-bg-app to-transparent">
      <div className="mx-10 relative bg-input border border-color rounded-xl shadow-md transition-all focus-within:border-primary focus-within:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1),0_0_0_2px_var(--primary-light)]">
        <textarea
          ref={textareaRef}
          className="w-full p-4 pl-5 pr-14 border-none bg-transparent resize-none font-inherit text-base text-text-primary outline-none min-h-15"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe what you want agent to handle..."
          rows={1}
          disabled={!isConnected}
        />
        <button
          type="button"
          className="absolute right-3 bottom-3 w-9 h-9 bg-primary text-white border-none rounded-md flex items-center justify-center cursor-pointer transition-colors hover:bg-primary-hover hover:scale-105 disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700"
          onClick={onSend}
          disabled={!isConnected || !inputText.trim()}
        >
          <Send size={16} />
        </button>
        {isCommandMenuOpen && (
          <div className="absolute left-0 right-0 bottom-[calc(100%+8px)] bg-surface border border-color shadow-lg rounded-xl z-20 p-1 max-h-60 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="p-3 text-center text-text-tertiary text-sm">
                No commands available.
              </div>
            ) : (
              filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.name}
                  type="button"
                  className={`w-full p-2 flex flex-col gap-0.5 border-none text-left bg-none cursor-pointer rounded-md ${
                    index === commandSelectedIndex ? "active" : ""
                  } hover:bg-surface-hover`}
                  onClick={() => onCommandPick(cmd)}
                >
                  <span className="font-semibold text-text-primary text-sm">
                    /{cmd.name}
                  </span>
                  <span className="text-text-secondary text-xs">
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
