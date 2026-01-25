import { Check, Copy } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { ghcolors } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

interface MessageTextProps {
  content: string;
  images?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    dataUrl: string;
    size: number;
  }>;
  sender?: "user" | "agent" | "system";
}

export const MessageText = ({ content, images = [], sender }: MessageTextProps) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error("Failed to copy code:", error);
    }
  };

  const isUser = sender === "user";

  return (
    <div className={`${isUser ? "text-right" : "text-left"}`}>
      <div className="prose prose-sm max-w-none text-text-primary">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "");
              const code = String(children).replace(/\n$/, "");

              if (!inline && match) {
                return (
                  <div className="relative my-4">
                    <div className="absolute top-2 right-2 z-10">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(code)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                      >
                        {copiedCode === code ? <Check size={12} /> : <Copy size={12} />}
                        {copiedCode === code ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <SyntaxHighlighter
                      style={ghcolors}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-lg border border-color"
                      customStyle={{
                        margin: 0,
                        fontSize: "14px",
                        borderRadius: "8px",
                        borderWidth: "1px",
                      }}
                      {...props}
                    >
                      {code}
                    </SyntaxHighlighter>
                  </div>
                );
              }

              return (
                <code
                  className={`inline-block px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono ${className}`}
                  {...props}
                >
                  {children}
                </code>
              );
            },
            table: ({ children, ...props }: any) => (
              <div className="overflow-x-auto my-4">
                <table
                  className="min-w-full border-collapse border border-gray-300 dark:border-gray-700"
                  {...props}
                >
                  {children}
                </table>
              </div>
            ),
            th: ({ children, ...props }: any) => (
              <th
                className="border border-gray-300 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-800 font-semibold text-sm"
                {...props}
              >
                {children}
              </th>
            ),
            td: ({ children, ...props }: any) => (
              <td
                className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
                {...props}
              >
                {children}
              </td>
            ),
            ul: ({ children, ...props }: any) => (
              <ul className="list-disc list-outside pl-5 my-2 space-y-1" {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }: any) => (
              <ol className="list-decimal list-outside pl-5 my-2 space-y-1" {...props}>
                {children}
              </ol>
            ),
            li: ({ children, ...props }: any) => (
              <li className="text-sm leading-relaxed" {...props}>
                {children}
              </li>
            ),
            p: ({ children, ...props }: any) => (
              <p className="text-sm leading-relaxed mb-2" {...props}>
                {children}
              </p>
            ),
            blockquote: ({ children, ...props }: any) => (
              <blockquote
                className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 py-1 my-4 text-sm italic text-gray-700 dark:text-gray-300"
                {...props}
              >
                {children}
              </blockquote>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {/* 图片显示 */}
      {images.length > 0 && (
        <div className={`flex flex-wrap gap-2 mt-3 ${isUser ? "justify-end" : "justify-start"}`}>
          {images.map((image) => (
            <div key={image.id} className="relative group">
              <img
                src={image.dataUrl}
                alt={image.filename}
                className="max-w-full h-auto rounded-lg shadow-md"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 rounded-b-lg">
                <p className="text-xs text-white truncate">{image.filename}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
