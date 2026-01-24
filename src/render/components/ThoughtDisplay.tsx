import { X } from "lucide-react";
import { useEffect, useState } from "react";

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

  const containerClass = style === "compact" ? "p-3 rounded-lg" : "p-4 rounded-xl";

  return (
    <div
      className={`bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 ${containerClass} relative`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2 animate-pulse" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">AI is thinking</h3>
            {running && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {formatTime(elapsed)}
              </span>
            )}
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{thought}</p>
        </div>
        {running && (
          <button
            type="button"
            onClick={onStop}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-blue-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
            title="Stop (ESC)"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
