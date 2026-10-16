"use client";

import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from "react";

export type Theme = "agri" | "neu";
export const THEME_STORAGE_KEY = "jy-theme";
export const DEFAULT_THEME: Theme = "agri";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(v: string | null): v is Theme {
  return v === "agri" || v === "neu";
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isTheme(stored)) {
        setThemeState(stored);
        document.documentElement.setAttribute("data-theme", stored);
      } else {
        document.documentElement.setAttribute("data-theme", DEFAULT_THEME);
      }
    } catch {
      document.documentElement.setAttribute("data-theme", DEFAULT_THEME);
    }
    setReady(true);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* 无痕模式等场景下静默失败 */
    }
  };

  const toggleTheme = () => setTheme(theme === "agri" ? "neu" : "agri");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme 必须在 <ThemeProvider> 内使用");
  return ctx;
}
