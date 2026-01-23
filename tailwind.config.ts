import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          app: "var(--bg-app)",
          sidebar: "var(--bg-sidebar)",
          surface: "var(--bg-surface)",
          "surface-muted": "var(--bg-surface-muted)",
          "surface-hover": "var(--bg-surface-hover)",
          input: "var(--bg-input)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },
        border: {
          DEFAULT: "var(--border-color)",
          hover: "var(--border-hover)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          light: "var(--primary-light)",
          fg: "var(--primary-fg)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "SFMono-Regular",
          "Consolas",
          "Liberation Mono",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      },
      keyframes: {
        "pulse-green": {
          "0%, 100%": {
            transform: "scale(1)",
            opacity: "1",
            boxShadow: "0 0 8px rgba(34, 197, 94, 0.6)",
          },
          "50%": {
            transform: "scale(1.1)",
            opacity: "0.9",
            boxShadow: "0 0 12px rgba(34, 197, 94, 0.8)",
          },
        },
        "ripple-green": {
          "0%": {
            transform: "translate(-50%, -50%) scale(0.8)",
            opacity: "0.8",
          },
          "100%": {
            transform: "translate(-50%, -50%) scale(2.4)",
            opacity: "0",
          },
        },
        "pulse-orange": {
          "0%": {
            opacity: "0.6",
            boxShadow: "0 0 4px rgba(249, 115, 22, 0.4)",
          },
          "100%": {
            opacity: "1",
            boxShadow: "0 0 12px rgba(249, 115, 22, 0.9)",
          },
        },
        "ripple-orange": {
          "0%": {
            transform: "translate(-50%, -50%) scale(0.5)",
            opacity: "0.8",
          },
          "100%": {
            transform: "translate(-50%, -50%) scale(2.5)",
            opacity: "0",
          },
        },
        "pulse-red": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "pulse-green": "pulse-green 3s infinite ease-in-out",
        "ripple-green": "ripple-green 3s infinite ease-out",
        "pulse-orange": "pulse-orange 1s infinite alternate",
        "ripple-orange": "ripple-orange 1.5s infinite linear",
        "pulse-red": "pulse-red 2s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
