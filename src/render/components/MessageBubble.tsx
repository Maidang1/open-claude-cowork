import { Brain, CheckCircle, ChevronDown, ChevronRight, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import type { Message } from "../types";

interface MessageBubbleProps {
  msg: Message;
}

export const MessageBubble = ({ msg }: MessageBubbleProps) => {
  const isUser = msg.sender === "user";
  const isSystem = msg.sender === "system";
  const [isThoughtOpen, setIsThoughtOpen] = useState(false);

  // Permission Request UI
  if (msg.permissionId) {
    const handlePermission = async (optionId: string | null) => {
      const response = optionId
        ? { outcome: { outcome: "selected", optionId } }
        : { outcome: { outcome: "cancelled" } };
      await window.electron.invoke("agent:permission-response", msg.permissionId, response);
    };

    return (
      <div className="message-wrapper" style={{ alignItems: "center" }}>
        <div className="system-init-block permission-request-block">
          <div className="permission-title">⚠️ Permission Request</div>
          <div style={{ marginBottom: "12px" }}>{msg.content}</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {msg.options?.map((opt: any) => (
              <button
                key={opt.optionId}
                type="button"
                onClick={() => handlePermission(opt.optionId)}
                className="permission-btn"
              >
                {opt.label || opt.name || opt.kind || opt.optionId}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePermission(null)}
              className="permission-btn deny"
            >
              Deny
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return null;
  }

  return (
    <div className="message-wrapper">
      <div className={`message-role ${isUser ? "user" : "assistant"}`}>
        {isUser ? "User" : "Assistant"}
      </div>

      <div className="message-content">
        {/* Thought Process (Collapsible) */}
        {msg.thought && (
          <div className="thought-process-header" onClick={() => setIsThoughtOpen(!isThoughtOpen)}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 500,
              }}
            >
              <Brain size={14} />
              <span>Thinking Process</span>
              {isThoughtOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            {isThoughtOpen && <div className="thought-process-content">{msg.thought}</div>}
          </div>
        )}

        {/* Main Content */}
        {msg.content && (
          <div className="markdown-content">
            {isUser ? (
              <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
            ) : (
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props) {
                    const { children, className, node, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || "");
                    return match ? (
                      // @ts-expect-error
                      <SyntaxHighlighter
                        {...rest}
                        PreTag="div"
                        language={match[1]}
                        style={vscDarkPlus}
                        customStyle={{
                          borderRadius: "8px",
                          fontSize: "0.85em",
                          margin: 0,
                        }}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code
                        {...rest}
                        className={className}
                        style={{
                          backgroundColor: "#f3f4f6",
                          padding: "2px 4px",
                          borderRadius: "4px",
                          color: "#ef4444",
                        }}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {msg.content}
              </Markdown>
            )}
          </div>
        )}

        {!isUser && msg.tokenUsage && (
          <div className="message-usage">
            Tokens: prompt {msg.tokenUsage.promptTokens ?? 0}, completion{" "}
            {msg.tokenUsage.completionTokens ?? 0}, total{" "}
            {msg.tokenUsage.totalTokens ??
              (msg.tokenUsage.promptTokens ?? 0) + (msg.tokenUsage.completionTokens ?? 0)}
          </div>
        )}

        {/* Tool Calls */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="tool-calls-container">
            {msg.toolCalls.map((tool) => (
              <div key={tool.id} className="tool-call-item">
                {tool.status === "pending" || tool.status === "in_progress" ? (
                  <Loader2 size={14} className="animate-spin" color="#f97316" />
                ) : tool.status === "completed" ? (
                  <CheckCircle size={14} color="#10b981" />
                ) : (
                  <XCircle size={14} color="#ef4444" />
                )}
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{tool.name}</span>
                <span style={{ color: "#9ca3af" }}>— {tool.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
