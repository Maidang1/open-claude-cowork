import { useEffect, useState } from "react";
import Markdown from "react-markdown";

interface ThoughtDisplayProps {
  thought: string;
  running: boolean;
  onStop: () => void;
  style?: "default" | "compact";
}

export const ThoughtDisplay = ({
  thought,
  running,
  onStop,
  style = "default",
}: ThoughtDisplayProps) => {
  const [elapsed, setElapsed] = useState(0);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onStop();
    }
  };

  const containerPadding = style === "compact" ? "p-3" : "p-4";
  const contentPadding = style === "compact" ? "p-3" : "p-4";

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0}>
      <div
        className={`rounded-2xl border border-amber-100/70 bg-amber-50/80 text-ink-800 shadow-soft focus:outline-none focus:ring-2 focus:ring-amber-200 ${containerPadding}`}
      >
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-amber-700">
          <div className="flex items-center gap-2 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span>Thinking</span>
          </div>
          <div className="flex items-center gap-2">
            {running && (
              <span className="font-mono text-[11px] text-amber-700/80">{formatTime(elapsed)}</span>
            )}
            {running && (
              <button
                type="button"
                onClick={onStop}
                className="rounded-full border border-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 transition hover:bg-amber-500/10"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        <div
          className={`mt-3 rounded-xl bg-white/90 ${contentPadding} text-sm text-ink-900 shadow-inner`}
        >
          <Markdown className="prose prose-sm max-w-none text-ink-900">{thought}</Markdown>
        </div>
      </div>
    </div>
  );
};
