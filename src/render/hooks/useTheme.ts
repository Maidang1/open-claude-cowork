import { useEffect, useMemo, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | "auto">(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return "auto";
    }
    return "light";
  });

  const effectiveTheme = useMemo(() => {
    if (theme !== "auto") return theme;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }, [theme]);

  useEffect(() => {
    const effectiveTheme =
      theme === "auto"
        ? window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "auto") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setThemeMode = (newTheme: "light" | "dark" | "auto") => {
    setTheme(newTheme);
  };

  return {
    theme,
    effectiveTheme,
    setThemeMode,
  };
}
