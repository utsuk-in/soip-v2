import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ThemeChoice = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeState {
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: ThemeChoice) => void;
}

const STORAGE_KEY = "soip_theme";

const ThemeContext = createContext<ThemeState | null>(null);

function getSystemPreference(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
    return stored && ["light", "dark", "system"].includes(stored) ? stored : "system";
  });

  const resolvedTheme: ResolvedTheme = theme === "system" ? getSystemPreference() : theme;

  const setTheme = useCallback((t: ThemeChoice) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(getSystemPreference());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
