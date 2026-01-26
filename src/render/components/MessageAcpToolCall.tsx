import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import type { TAcpToolCallMessage } from "../types/messageTypes";

interface MessageAcpToolCallProps {
  msg: TAcpToolCallMessage;
}

export const MessageAcpToolCall = ({ msg }: MessageAcpToolCallProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isOutputExpanded, setIsOutputExpanded] = useState(false);
  const [outputHeight, setOutputHeight] = useState<number | null>(null);
  const outputRef = useState<HTMLDivElement | null>(null);

  const mergedContent = useMemo(
    () => ({
      ...msg.content,
      ...(msg.content.update || {}),
    }),
    [msg.content],
  );

  const { toolCallId, name, kind, title, description, rawInput, rawOutput } =
    mergedContent;

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
        input.command ||
        input.cmd ||
        input.input ||
        input.query ||
        input.prompt ||
        input.script;
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
    const asObject = rawOutput as Record<string, any>;
    const formatted =
      asObject.formatted_output ||
      asObject.formattedOutput ||
      asObject.output ||
      asObject.result ||
      asObject.text ||
      asObject.message ||
      asObject.data?.formatted_output ||
      asObject.data?.formattedOutput ||
      asObject.data?.output;
    if (typeof formatted === "string" && formatted.trim()) {
      const duration =
        asObject.duration ??
        asObject.duration_ms ??
        asObject.elapsed ??
        asObject.time_ms ??
        asObject.metrics?.duration ??
        asObject.metrics?.duration_ms;
      const formatDuration = (value: any) => {
        if (typeof value !== "number" || Number.isNaN(value)) return null;
        if (value < 1000) return `${value} ms`;
        const seconds = value / 1000;
        if (seconds < 60) return `${seconds.toFixed(1)} s`;
        const minutes = Math.floor(seconds / 60);
        const rest = Math.round(seconds % 60);
        return `${minutes}m ${rest}s`;
      };
      const durationLabel = formatDuration(duration);
      if (durationLabel) {
        return `Duration: ${durationLabel}\n\n${formatted.trimEnd()}`;
      }
      return formatted.trimEnd();
    }
    try {
      return JSON.stringify(rawOutput, null, 2);
    } catch {
      return String(rawOutput);
    }
  }, [rawOutput]);

  const handleOutputRef = (node: HTMLDivElement | null) => {
    outputRef[1](node);
    if (node) {
      setOutputHeight(node.scrollHeight);
    }
  };

  const maxHeight = 200;
  const hasHiddenContent = outputHeight !== null && outputHeight > maxHeight;

  const rawToolLabel = kind || name || title || "Tool";
  const rawToolParts = rawToolLabel.split(/\s+/).filter(Boolean);
  const rawToolName = rawToolParts[0] || rawToolLabel;
  const toolLabel =
    rawToolName.length > 0
      ? rawToolName.charAt(0).toUpperCase() + rawToolName.slice(1)
      : rawToolName;
  const commandLabelRaw = getCommandLabel(rawInput);
  const titleRemainder = rawToolParts.slice(1).join(" ").trim();
  const normalizedCommand = commandLabelRaw
    .replace(new RegExp(`^${rawToolName}\\s+`, "i"), "")
    .replace(new RegExp(`^${toolLabel}\\s+`, "i"), "")
    .trim();
  const commandLabel = normalizedCommand || titleRemainder || "";
  const outputLabel = "Output";

  return (
    <div className="max-w-[720px] w-full">
      <div className="rounded-[8px] bg-surface-secondary px-3 py-2 text-[14px] font-medium text-text-primary shadow-soft">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-accent font-semibold">{toolLabel}</span>
          {commandLabel && (
            <span className="truncate font-mono text-ink-600">
              {commandLabel}
            </span>
          )}
        </div>
      </div>

      {rawOutput !== undefined && (
        <div className="mt-2">
          <div className="text-[14px] font-medium text-accent my-2 ">
            {outputLabel}
          </div>
          <div
            ref={handleOutputRef}
            className={`rounded-[8px] bg-surface-secondary px-4 py-2 text-[14px] leading-relaxed text-text-secondary shadow-soft overflow-auto transition-all duration-200 ${
              !isOutputExpanded && hasHiddenContent
                ? "max-h-[200px]"
                : "max-h-none"
            }`}
          >
            <pre className="whitespace-pre-wrap font-mono">{outputText}</pre>
          </div>
          {hasHiddenContent && (
            <button
              type="button"
              onClick={() => setIsOutputExpanded((prev) => !prev)}
              className="mt-2 text-[12px] font-medium text-accent hover:text-accent-hover"
            >
              {isOutputExpanded ? "▲ Collapse" : "▼ Expand"}
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
            {showDetails ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            {showDetails ? "Hide details" : "Show details"}
          </button>
        </div>
      )}

      {showDetails && (
        <div className="mt-3 space-y-3">
          {description && (
            <div className="text-xs text-text-secondary">{description}</div>
          )}
          {kind && (
            <div className="text-xs text-text-secondary">Kind: {kind}</div>
          )}
          {rawInput !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[11px] font-medium text-text-secondary uppercase">
                  Input
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(JSON.stringify(rawInput, null, 2), "input")
                  }
                  className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"
                >
                  {copied === "input" ? (
                    <Check size={12} />
                  ) : (
                    <Copy size={12} />
                  )}
                  {copied === "input" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="rounded-lg bg-input px-3 py-2 text-[11px] text-text-secondary shadow-soft whitespace-break-spaces">
                {typeof rawInput === "string"
                  ? rawInput
                  : JSON.stringify(rawInput, null, 2)}
              </pre>
            </div>
          )}
          {toolCallId && (
            <div className="text-[11px] text-text-tertiary">
              Tool Call ID: {toolCallId}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
