import type { ReactElement, ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

// 全部使用语义类（随主题换肤），不出现硬编码色板类。
const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-surface-subtle text-body",
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
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
