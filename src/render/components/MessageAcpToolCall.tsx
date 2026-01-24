import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useState } from "react";
import type { TAcpToolCallMessage } from "../types/messageTypes";

interface MessageAcpToolCallProps {
  msg: TAcpToolCallMessage;
}

export const MessageAcpToolCall = ({ msg }: MessageAcpToolCallProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const {
    toolCallId,
    name,
    kind,
    status = "in_progress",
    title,
    description,
    rawInput,
    rawOutput,
  } = msg.content;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "pending":
        return "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20";
      case "in_progress":
        return "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20";
      case "completed":
        return "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20";
      case "failed":
        return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20";
      default:
        return "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "pending":
        return "⏳";
      case "in_progress":
        return "🔄";
      case "completed":
        return "✅";
      case "failed":
        return "❌";
      default:
        return "📦";
    }
  };

  return (
    <div className="bg-surface border border-color rounded-lg p-4">
      {/* 工具调用头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full ${getStatusColor()} flex items-center justify-center`}
          >
            {getStatusIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-text-primary text-sm">
              {name || title || "Tool Call"}
            </h3>
            {kind && <p className="text-xs text-text-secondary">Kind: {kind}</p>}
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {status}
        </span>
      </div>

      {/* 工具调用描述 */}
      {description && <p className="text-sm text-text-secondary mb-3">{description}</p>}

      {/* 详细信息 */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          {showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {showDetails ? "Hide Details" : "Show Details"}
        </button>

        {showDetails && (
          <div className="mt-2 space-y-3">
            {/* 原始输入 */}
            {rawInput !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-medium text-text-secondary uppercase">Raw Input</h4>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(rawInput, null, 2), "input")}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
                  >
                    {copied === "input" ? <Check size={12} /> : <Copy size={12} />}
                    {copied === "input" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-xs overflow-x-auto">
                  {typeof rawInput === "string" ? rawInput : JSON.stringify(rawInput, null, 2)}
                </pre>
              </div>
            )}

            {/* 原始输出 */}
            {rawOutput !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-medium text-text-secondary uppercase">Raw Output</h4>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(rawOutput, null, 2), "output")}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
                  >
                    {copied === "output" ? <Check size={12} /> : <Copy size={12} />}
                    {copied === "output" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-xs overflow-x-auto">
                  {typeof rawOutput === "string" ? rawOutput : JSON.stringify(rawOutput, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 工具调用ID */}
      {toolCallId && <div className="text-xs text-text-tertiary">Tool Call ID: {toolCallId}</div>}
    </div>
  );
};
