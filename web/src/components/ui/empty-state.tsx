import type { ReactElement, ReactNode } from "react";

/** 空状态：居中弱色，可选图标与操作按钮；compact 用于卡片内部 / 表格空行。 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}): ReactElement {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-2 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-muted">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-body">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-5 text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
