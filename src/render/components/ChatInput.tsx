import { Send, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AgentCommandInfo, ImageAttachment } from "../types";

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
  images: ImageAttachment[];
  onImagesChange: (images: ImageAttachment[]) => void;
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
  images,
  onImagesChange,
}: ChatInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  // 处理粘贴事件
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.startsWith("image/")) {
        e.preventDefault();

        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();

          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const image: ImageAttachment = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              filename: file.name || `image-${Date.now()}`,
              mimeType: file.type,
              dataUrl,
              size: file.size,
            };

            onImagesChange([...images, image]);
          };

          reader.readAsDataURL(file);
        }
      }
    }
  };

  // 删除图片
  const removeImage = (imageId: string) => {
    onImagesChange(images.filter((img) => img.id !== imageId));
  };

  return (
    <div className="py-6 pb-8 bg-gradient-to-t from-bg-app to-transparent">
      <div className="mx-10 relative bg-input border border-color rounded-xl shadow-md transition-all focus-within:border-ink-900/20 focus-within:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)]">
        {/* 图片预览区域 */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 border-b border-color">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.dataUrl}
                  alt={image.filename}
                  className="h-16 w-16 object-cover rounded-md"
                />
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="w-full p-4 pl-5 pr-14 border-none bg-transparent resize-none font-inherit text-base text-text-primary outline-none min-h-15"
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder="Describe what you want agent to handle... (paste images to include)"
          rows={1}
          disabled={!isConnected}
        />
        <button
          type="button"
          className="absolute right-3 bottom-3 w-9 h-9 bg-primary text-white border-none rounded-md flex items-center justify-center cursor-pointer transition-colors hover:bg-primary-hover hover:scale-105 disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700"
          onClick={onSend}
          disabled={!isConnected || (!inputText.trim() && images.length === 0)}
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
                  <span className="font-semibold text-text-primary text-sm">/{cmd.name}</span>
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
