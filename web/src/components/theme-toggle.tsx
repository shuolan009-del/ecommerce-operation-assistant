"use client";

import { Layers, Leaf } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border p-0.5 transition-colors"
      style={{
        borderRadius: "var(--t-r-full, 9999px)",
        border: "var(--t-control-border, 1px solid #D2C1A3)",
        background: "var(--t-surface, #FFFDF8)",
        boxShadow: "var(--t-control-shadow, var(--t-sh-sm))",
      }}
      role="group"
      aria-label="切换外观主题"
    >
      <button
        type="button"
        aria-pressed={theme === "agri"}
        title="农业温暖"
        onClick={() => setTheme("agri")}
        className="flex h-7 items-center gap-1 rounded-full px-2.5 text-xs transition-colors"
        style={{
          borderRadius: "var(--t-r-full, 9999px)",
          background: theme === "agri" ? "var(--t-sidebar-active-bg, var(--primary))" : "transparent",
          color: theme === "agri" ? "var(--t-sidebar-active-fg, #fff)" : "var(--t-ink-3, #8A7757)",
        }}
      >
        <Leaf className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">农业温暖</span>
      </button>
      <button
        type="button"
        aria-pressed={theme === "neu"}
        title="新拟态"
        onClick={() => setTheme("neu")}
        className="flex h-7 items-center gap-1 rounded-full px-2.5 text-xs transition-colors"
        style={{
          borderRadius: "var(--t-r-full, 9999px)",
          background: theme === "neu" ? "var(--t-sidebar-active-bg, transparent)" : "transparent",
          color: theme === "neu" ? "var(--t-sidebar-active-fg, var(--primary-hover))" : "var(--t-ink-3, #8A7757)",
        }}
      >
        <Layers className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">新拟态</span>
      </button>
    </div>
  );
}
