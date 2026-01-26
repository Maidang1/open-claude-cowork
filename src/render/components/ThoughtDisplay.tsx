import type { KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";

interface ThoughtDisplayProps {
  thought: string;
  running: boolean;
  onStop: () => void;
  style?: "default" | "compact";
  label?: string;
}

export const ThoughtDisplay = ({
  thought,
  running,
  onStop,
  style = "default",
  label,
}: ThoughtDisplayProps) => {
  const [elapsed, setElapsed] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let timer: number;
    if (running) {
      const start = Date.now() - elapsed;
      timer = window.setInterval(() => {
        setElapsed(Date.now() - start);
      }, 100);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [running]);

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0
      ? `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
      : `${remainingSeconds}s`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      onStop();
    }
  };

  const containerPadding = style === "compact" ? "py-1" : "py-2";
  const contentSpacing = style === "compact" ? "mt-2" : "mt-3";

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0}>
      <div
        className={`text-ink-800 focus:outline-none focus:ring-2 focus:ring-accent/20 ${containerPadding}`}
      >
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-ink-500">
          <div className="flex items-center gap-2 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span>Thinking</span>
            {label ? (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600">
                ID: {label}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="rounded-full border border-ink-900/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600 transition hover:bg-surface-tertiary"
            >
              {collapsed ? "Show" : "Hide"}
            </button>
            {running && (
              <span className="font-mono text-[11px] text-ink-500">{formatTime(elapsed)}</span>
            )}
            {running && (
              <button
                type="button"
                onClick={onStop}
                className="rounded-full border border-ink-900/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600 transition hover:bg-surface-tertiary"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className={`${contentSpacing} text-sm text-ink-800`}>
            <div className="prose prose-sm max-w-none text-ink-800">
              <Markdown>{thought}</Markdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
