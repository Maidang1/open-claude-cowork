import { Button, Space, Tag } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Bubble, Think, type BubbleItemType } from "@ant-design/x";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import type { Message, ToolCall } from "../types";

interface AntDXMessageProps {
  msg: Message;
  onPermissionResponse?: (
    permissionId: string,
    optionId: string | null,
  ) => void;
  isLoading?: boolean;
}

const ToolCallItem = ({ tool }: { tool: ToolCall }) => {
  const statusConfig = {
    pending: {
      icon: <LoadingOutlined spin color="orange" />,
      status: "pending",
    },
    in_progress: {
      icon: <LoadingOutlined spin color="orange" />,
      status: "in progress",
    },
    completed: {
      icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
      status: "completed",
    },
    failed: {
      icon: <CloseCircleOutlined style={{ color: "#ff4d4f" }} />,
      status: "failed",
    },
  };

  const config = statusConfig[tool.status];

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md border text-xs bg-slate-50/50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200">
      {config.icon}
      <span className="font-mono font-medium">{tool.name}</span>
      <Tag style={{ margin: 0, fontSize: "11px" }}>{config.status}</Tag>
    </div>
  );
};

const MarkdownContent = ({ content }: { content: string }) => {
  return (
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
              className="px-1 py-0.5 rounded font-mono text-[0.9em] bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </Markdown>
  );
};

const TokenUsage = ({ tokenUsage }: { tokenUsage: any }) => {
  if (!tokenUsage) return null;

  const promptTokens = tokenUsage.promptTokens ?? 0;
  const completionTokens = tokenUsage.completionTokens ?? 0;
  const totalTokens = tokenUsage.totalTokens ?? promptTokens + completionTokens;

  return (
    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
      Tokens: {promptTokens} prompt, {completionTokens} completion,{" "}
      {totalTokens} total
    </div>
  );
};

export const AntDXMessage = ({
  msg,
  onPermissionResponse,
  isLoading = false,
}: AntDXMessageProps) => {
  const isUser = msg.sender === "user";
  const isSystem = msg.sender === "system";

  // Permission Request UI - render as special system message
  if (msg.permissionId) {
    const handlePermission = (optionId: string | null) => {
      if (onPermissionResponse) {
        onPermissionResponse(msg.permissionId, optionId);
      }
    };

    return (
      <div className="p-4 px-5 bg-orange-50 border border-orange-200 rounded-lg my-4 dark:bg-orange-500/10 dark:border-orange-500/50">
        <div className="font-semibold mb-3 text-orange-600 dark:text-orange-400 flex items-center gap-2">
          <span>⚠️</span>
          <span>Permission Request</span>
        </div>
        <div className="mb-3 text-gray-700">{msg.content}</div>
        <Space wrap>
          {msg.options?.map((opt: any) => (
            <Button
              key={opt.optionId}
              type="primary"
              size="small"
              onClick={() => handlePermission(opt.optionId)}
            >
              {opt.label || opt.name || opt.kind || opt.optionId}
            </Button>
          ))}
          <Button size="small" danger onClick={() => handlePermission(null)}>
            Deny
          </Button>
        </Space>
      </div>
    );
  }

  // System messages are not rendered
  if (isSystem) {
    return null;
  }

  // User message - simple rendering
  if (isUser) {
    const bubbleItem: BubbleItemType = {
      key: msg.id,
      role: "user",
      placement: "end",
      content: msg.content || "",
      variant: "filled",
      contentRender: (content: string) => (
        <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>
      ),
    };

    return (
      <div className="mx-10">
        <Bubble {...bubbleItem} />
      </div>
    );
  }

  // AI message - render thought, tools, and content in order
  const hasThought = msg.thought && msg.thought.length > 0;
  const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
  const hasContent = msg.content && msg.content.length > 0;

  if (isLoading) {
    // Loading state
    return (
      <div className="mx-10">
        <Bubble
          key={msg.id}
          role="ai"
          placement="start"
          content=""
          variant="borderless"
          header={() => (
            <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-500 mb-1">
              Assistant
            </div>
          )}
          contentRender={() => (
            <div className="flex items-center gap-2 py-2">
              <LoadingOutlined spin style={{ color: "#f97316" }} />
              <span className="text-slate-500 dark:text-slate-400">
                Thinking...
              </span>
            </div>
          )}
        />
      </div>
    );
  }

  // Render AI message with thought, tools, and content
  return (
    <div className="mx-10">
      {/* Header */}
      <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-500 mb-1 ml-1">
        Assistant
      </div>

      {/* Thought Process (streaming) */}
      {hasThought && (
        <div className="mt-5 mb-2 text-xs ml-0.5">
          <Think title="Thinking Process" icon={<></>}>
            <Markdown>{msg.thought}</Markdown>
          </Think>
        </div>
      )}

      {/* Tool Calls */}
      {hasToolCalls && (
        <div className="flex flex-col gap-1.5 mb-2">
          {msg.toolCalls.map((tool) => (
            <ToolCallItem key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {/* Content (final response) */}
      {hasContent && (
        <Bubble
          key={msg.id}
          role="ai"
          placement="start"
          content={msg.content}
          variant="borderless"
          contentRender={(content: string) => (
            <MarkdownContent content={content} />
          )}
          footer={() => <TokenUsage tokenUsage={msg.tokenUsage} />}
        />
      )}
    </div>
  );
};
