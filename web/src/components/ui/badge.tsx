import type { ReactElement, ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-cyan-50 text-cyan-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700",
};

/** 状态徽标：tone 由调用方显式指定，组件不自动推断状态词。 */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <span
      className={[
        "inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
