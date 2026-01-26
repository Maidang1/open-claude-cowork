import { CheckCircle2, Circle, MinusCircle } from "lucide-react";
import Markdown from "react-markdown";
import type { ITodoContent, ITodoItem } from "../types/messageTypes";

interface TodoMessageProps {
  content: ITodoContent;
}

const statusIcon = (status?: ITodoItem["status"]) => {
  switch (status) {
    case "done":
      return <CheckCircle2 className="text-green-500" size={16} />;
    case "in_progress":
      return <MinusCircle className="text-amber-500" size={16} />;
    default:
      return <Circle className="text-gray-400" size={16} />;
  }
};

export const TodoMessage = ({ content }: TodoMessageProps) => {
  const { title, description, items = [], rawText } = content;
  const showMarkdownBody = rawText && items.length === 0;

  return (
    <div className="space-y-3 text-left">
      {title && <div className="text-sm font-semibold text-ink-800">{title}</div>}
      {description && <p className="text-sm text-ink-600">{description}</p>}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={item.id || idx} className="flex items-start gap-2">
              <div className="mt-0.5">{statusIcon(item.status)}</div>
              <div>
                <p className="text-sm text-ink-800">{item.text}</p>
                {item.note && <p className="text-xs text-ink-500">{item.note}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : showMarkdownBody ? (
        <div className="prose prose-sm max-w-none text-ink-800">
          <Markdown>{rawText || ""}</Markdown>
        </div>
      ) : null}
    </div>
  );
};
