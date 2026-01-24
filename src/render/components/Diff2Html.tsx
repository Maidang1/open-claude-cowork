import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Diff2HtmlProps {
  oldContent?: string;
  newContent?: string;
  fileName?: string;
  showLineNumbers?: boolean;
}

export const Diff2Html = ({
  oldContent,
  newContent,
  fileName,
  showLineNumbers = true,
}: Diff2HtmlProps) => {
  const [showDiff, setShowDiff] = useState(true);

  if (!oldContent && !newContent) {
    return null;
  }

  const oldLines = oldContent ? oldContent.split("\n") : [];
  const newLines = newContent ? newContent.split("\n") : [];

  // 简单的差异高亮逻辑
  const getDiffLines = () => {
    const lines = [];
    const maxLength = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === newLine) {
        lines.push({ type: "unchanged", content: oldLine, lineNumber: i + 1 });
      } else if (oldLine && !newLine) {
        lines.push({ type: "removed", content: oldLine, lineNumber: i + 1 });
      } else if (!oldLine && newLine) {
        lines.push({ type: "added", content: newLine, lineNumber: i + 1 });
      } else {
        lines.push({ type: "removed", content: oldLine, lineNumber: i + 1 });
        lines.push({ type: "added", content: newLine, lineNumber: i + 1 });
      }
    }

    return lines;
  };

  const diffLines = getDiffLines();

  const getLineClass = (type: string) => {
    switch (type) {
      case "added":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
      case "removed":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
      case "unchanged":
        return "bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300";
    }
  };

  const getLineIndicator = (type: string) => {
    switch (type) {
      case "added":
        return "+";
      case "removed":
        return "-";
      default:
        return " ";
    }
  };

  return (
    <div className="bg-surface border border-color rounded-lg overflow-hidden">
      {/* 文件名和切换按钮 */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border-b border-color">
        <h3 className="font-semibold text-text-primary text-sm">{fileName || "File Changes"}</h3>
        <button
          type="button"
          onClick={() => setShowDiff(!showDiff)}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          {showDiff ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {showDiff ? "Hide Diff" : "Show Diff"}
        </button>
      </div>

      {/* 差异内容 */}
      {showDiff && (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <tbody>
              {diffLines.map((line, index) => (
                <tr key={index} className={getLineClass(line.type)}>
                  {showLineNumbers && (
                    <td className="px-3 py-1 text-right text-text-tertiary border-r border-color">
                      {line.lineNumber}
                    </td>
                  )}
                  <td className="px-3 py-1 w-4 text-center border-r border-color">
                    {getLineIndicator(line.type)}
                  </td>
                  <td className="px-3 py-1 whitespace-pre">{line.content || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
