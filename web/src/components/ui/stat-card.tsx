import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

export type StatTone = "default" | "brand" | "success" | "warning" | "danger";

type StatCardProps = {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  trend?: { value: string; direction: "up" | "down" };
  tone?: StatTone;
  className?: string;
};

const valueToneClass: Record<StatTone, string> = {
  default: "text-strong",
  brand: "text-brand",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/** 指标卡：标签 + 数值（+ 单位）+ 可选涨跌徽标。 */
export function StatCard({
  label,
  value,
  unit,
  hint,
  trend,
  tone = "default",
  className,
}: StatCardProps): ReactElement {
  return (
    <div
      className={[
        "rounded-lg border border-hairline bg-surface p-4 shadow-card",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-xs text-muted">{label}</p>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-2xl font-semibold leading-none ${valueToneClass[tone]}`}>
          {value}
        </span>
        {unit ? <span className="text-xs text-muted">{unit}</span> : null}
      </div>

      {trend || hint ? (
        <div className="mt-2 flex items-center gap-2">
          {trend ? (
            <span
              className={[
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium",
                // 中国市场惯例：涨为红、跌为绿。
                trend.direction === "up"
                  ? "bg-danger-soft text-danger"
                  : "bg-success-soft text-success",
              ].join(" ")}
            >
              {trend.direction === "up" ? (
                <ArrowUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3 w-3" aria-hidden="true" />
              )}
              {trend.value}
            </span>
          ) : null}
          {hint ? <span className="truncate text-xs text-muted">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** 指标卡栅格：2 列起步、大屏 4 列自适应。 */
export function StatCardGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      className={["grid grid-cols-2 gap-3 lg:grid-cols-4", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
