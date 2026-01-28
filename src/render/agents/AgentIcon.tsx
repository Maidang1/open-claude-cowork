import { Claude, Gemini, OpenAI, Qwen } from "@lobehub/icons";
import type { CSSProperties } from "react";

const ICONS = {
  qwen: Qwen,
  claude: Claude,
  opencode: ()=> null,
  openai: OpenAI,
  gemini: Gemini,
} as const;

type AgentIconProps = {
  icon?: string | null;
  size?: number;
  style?: CSSProperties;
};

const defaultStyle: CSSProperties = {
  display: "block",
  lineHeight: 1,
};

export const AgentIcon = ({ icon, size = 16, style }: AgentIconProps) => {
  if (!icon) return null;
  const Icon = ICONS[icon as keyof typeof ICONS];
  if (!Icon) return null;
  return <Icon aria-hidden="true" size={size} style={{ ...defaultStyle, ...style }} />;
};
