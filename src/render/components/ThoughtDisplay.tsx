import { Think } from "@ant-design/x";
import { Button } from "antd";
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

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0}>
      <Think
        title="AI is thinking"
        icon={
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse " />
        }
      >
        <div className="space-y-2">
          {running && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {formatTime(elapsed)}
            </div>
          )}
          <Markdown>{thought}</Markdown>
          {running && (
            <Button size="small" danger onClick={onStop}>
              Stop
            </Button>
          )}
        </div>
      </Think>
    </div>
  );
};
