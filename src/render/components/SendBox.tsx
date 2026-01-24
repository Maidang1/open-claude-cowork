import { Paperclip, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ImageAttachment } from "../types";

interface SendBoxProps {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  placeholder?: string;
  onStop?: () => void;
  onFilesAdded?: (files: File[]) => void;
  supportedExts?: string[];
  tools?: React.ReactNode;
  prefix?: React.ReactNode;
  onSend: () => void;
}

export const SendBox = ({
  value,
  onChange,
  loading,
  placeholder = "Type your message...",
  onStop,
  onFilesAdded,
  supportedExts = ["image/png", "image/jpeg", "image/webp"],
  tools,
  prefix,
  onSend,
}: SendBoxProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  // 自动调整文本区域高度
  useEffect(() => {
    if (textareaRef.current && !isComposing) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [value, isComposing]);

  // 处理拖拽上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // 处理粘贴事件
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && supportedExts.includes(item.type)) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      handleFiles(files);
    }
  };

  // 处理文件选择
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
    // 重置input值以允许选择同一文件
    e.target.value = "";
  };

  // 处理文件上传
  const handleFiles = (files: File[]) => {
    const validFiles = files.filter((file) => supportedExts.includes(file.type));
    if (validFiles.length > 0 && onFilesAdded) {
      onFilesAdded(validFiles);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (loading && onStop) {
        onStop();
      } else if (value) {
        onChange("");
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && value.trim()) {
        onSend();
      }
    }
  };

  // 输入法合成事件
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  };

  return (
    <div className="py-6 pb-8 bg-gradient-to-t from-bg-app to-transparent">
      <div
        className="mx-10 relative bg-input border border-color rounded-xl shadow-md transition-all focus-within:border-primary focus-within:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1),0_0_0_2px_var(--primary-light)]"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* 前缀内容（如文件预览列表） */}
        {prefix}

        {/* 工具按钮 */}
        {tools && <div className="flex items-center gap-2 p-2 border-b border-color">{tools}</div>}

        {/* 文本输入区域 */}
        <textarea
          ref={textareaRef}
          className="w-full p-4 pl-5 pr-14 border-none bg-transparent resize-none font-inherit text-base text-text-primary outline-none min-h-15"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={placeholder}
          rows={1}
          disabled={loading}
        />

        {/* 操作按钮 */}
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          {/* 停止按钮 */}
          {loading && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="w-9 h-9 bg-red-500 text-white rounded-md flex items-center justify-center cursor-pointer transition-colors hover:bg-red-600"
              title="Stop (ESC)"
            >
              <X size={16} />
            </button>
          )}

          {/* 发送/加载按钮 */}
          {loading ? (
            <div className="w-9 h-9 bg-primary text-white rounded-md flex items-center justify-center cursor-wait">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <button
              type="button"
              onClick={onSend}
              className="w-9 h-9 bg-primary text-white border-none rounded-md flex items-center justify-center cursor-pointer transition-colors hover:bg-primary-hover hover:scale-105 disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700"
              disabled={!value.trim()}
              title="Send (Enter)"
            >
              <Send size={16} />
            </button>
          )}
        </div>

        {/* 隐藏的文件输入 */}
        {onFilesAdded && (
          <input
            type="file"
            multiple
            accept={supportedExts.join(",")}
            onChange={handleFileInputChange}
            className="hidden"
            id="file-input"
          />
        )}
      </div>
    </div>
  );
};
