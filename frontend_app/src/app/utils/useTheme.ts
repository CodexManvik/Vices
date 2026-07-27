/**
 * useTheme.ts
 *
 * Single source of truth for light/dark theming.
 * Sets data-theme on <html> (driving the --v-* design tokens in theme.css)
 * plus the legacy `dark` class for components still using Tailwind dark:.
 * Persists to localStorage; defaults to the OS preference on first launch.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "vices_theme";

function getInitialTheme(): "dark" | "light" {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "dark" || saved === "light") return saved;
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, isDark: theme === "dark", toggleTheme };
}
