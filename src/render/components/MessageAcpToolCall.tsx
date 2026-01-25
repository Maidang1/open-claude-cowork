import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import type { TAcpToolCallMessage } from "../types/messageTypes";

interface MessageAcpToolCallProps {
  msg: TAcpToolCallMessage;
}

export const MessageAcpToolCall = ({ msg }: MessageAcpToolCallProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isOutputExpanded, setIsOutputExpanded] = useState(true);

  const mergedContent = useMemo(
    () => ({
      ...msg.content,
      ...(msg.content.update || {}),
    }),
    [msg.content],
  );

  const { toolCallId, name, kind, title, description, rawInput, rawOutput } = mergedContent;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getCommandLabel = (input: any) => {
    if (!input) return "";
    if (typeof input === "string") return input;
    if (typeof input === "object") {
      if (Array.isArray(input.command)) {
        const last = input.command[input.command.length - 1];
        if (typeof last === "string") return last;
        return input.command.join(" ");
      }
      if (Array.isArray(input.parsed_cmd)) {
        const parts = input.parsed_cmd
          .map((item: any) => item?.cmd || item?.command || item?.path)
          .filter(Boolean);
        if (parts.length > 0) return parts.join(" ");
      }
      const candidate =
        input.command || input.cmd || input.input || input.query || input.prompt || input.script;
      if (typeof candidate === "string") return candidate;
      try {
        return JSON.stringify(input);
      } catch {
        return "";
      }
    }
    return "";
  };

  const outputText = useMemo(() => {
    if (rawOutput === undefined || rawOutput === null) return "";
    if (typeof rawOutput === "string") return rawOutput.trimEnd();
    try {
      return JSON.stringify(rawOutput, null, 2);
    } catch {
      return String(rawOutput);
    }
  }, [rawOutput]);

  const outputLines = useMemo(() => {
    if (!outputText) return [];
    return outputText.split("\n");
  }, [outputText]);

  const maxPreviewLines = 6;
  const hasHiddenLines = outputLines.length > maxPreviewLines;
  const visibleLines = isOutputExpanded ? outputLines : outputLines.slice(0, maxPreviewLines);
  const hiddenLineCount = Math.max(outputLines.length - visibleLines.length, 0);

  const rawToolLabel = name || title || "Tool";
  const toolLabel =
    rawToolLabel.length > 0
      ? rawToolLabel.charAt(0).toUpperCase() + rawToolLabel.slice(1)
      : rawToolLabel;
  const commandLabel = getCommandLabel(rawInput);
  const outputLabel = "Output";

  return (
    <div className="max-w-[720px] w-full">
      <div className="rounded-full bg-surface-tertiary px-4 py-2 text-[12px] font-medium text-text-primary border border-color shadow-card">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-accent">{toolLabel}</span>
          {commandLabel && <span className="truncate text-text-secondary">{commandLabel}</span>}
        </div>
      </div>

      {rawOutput !== undefined && (
        <div className="mt-3">
          <div className="text-[13px] font-medium text-accent mb-2">{outputLabel}</div>
          <div className="rounded-xl border border-color bg-surface-tertiary px-4 py-3 text-xs leading-relaxed text-text-secondary shadow-card">
            <pre className="whitespace-pre-wrap font-mono">
              {visibleLines.length > 0 ? visibleLines.join("\n") : ""}
            </pre>
          </div>
          {hasHiddenLines && (
            <button
              type="button"
              onClick={() => setIsOutputExpanded((prev) => !prev)}
              className="mt-2 text-[12px] font-medium text-accent hover:text-accent-hover"
            >
              {isOutputExpanded
                ? "▲ Collapse"
                : `▼ Show ${hiddenLineCount} more line${hiddenLineCount > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}

      {(rawInput !== undefined || kind || toolCallId) && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary"
          >
            {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {showDetails ? "Hide details" : "Show details"}
          </button>
        </div>
      )}

      {showDetails && (
        <div className="mt-3 space-y-3">
          {description && <div className="text-xs text-text-secondary">{description}</div>}
          {kind && <div className="text-xs text-text-secondary">Kind: {kind}</div>}
          {rawInput !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[11px] font-medium text-text-secondary uppercase">Input</h4>
                <button
                  type="button"
                  onClick={() => handleCopy(JSON.stringify(rawInput, null, 2), "input")}
                  className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"
                >
                  {copied === "input" ? <Check size={12} /> : <Copy size={12} />}
                  {copied === "input" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="rounded-lg border border-color bg-input px-3 py-2 text-[11px] text-text-secondary">
                {typeof rawInput === "string" ? rawInput : JSON.stringify(rawInput, null, 2)}
              </pre>
            </div>
          )}
          {toolCallId && (
            <div className="text-[11px] text-text-tertiary">Tool Call ID: {toolCallId}</div>
          )}
        </div>
      )}
    </div>
  );
};
