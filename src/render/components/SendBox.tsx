import { Send, X } from "lucide-react";
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
    <section className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-surface via-surface to-transparent pb-6 px-2 lg:pb-8 lg:ml-[280px]">
      <div
        className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 shadow-card transition-colors focus-within:border-ink-900/20"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {prefix}
        {tools && <div className="flex items-center gap-2 border-b border-ink-900/10 pb-2">{tools}</div>}

        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none bg-transparent py-1.5 text-sm text-ink-800 placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="flex items-center gap-2">
            {loading ? (
              onStop ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-error text-white transition-colors hover:bg-error/90"
                  title="Stop (ESC)"
                >
                  <X size={14} />
                </button>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={onSend}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!value.trim()}
                title="Send (Enter)"
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </div>

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
    </section>
  );
};
