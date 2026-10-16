import type { CSSProperties, ReactElement, ReactNode } from "react";

import { EmptyState } from "./empty-state";

/** 表格容器：白卡 + 圆角 + 描边 + 裁切溢出。 */
export function TableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      className={[
        "overflow-hidden rounded-lg border border-hairline bg-surface",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/**
 * 表头行。现有页面用 CSS Grid 手写列宽，因此 `columns` 直接是
 * `grid-template-columns` 字符串（空格分隔，如 "1.6fr 0.8fr 0.7fr"）。
 */
export function TableHead({
  columns,
  children,
  className,
}: {
  columns: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      style={{ gridTemplateColumns: columns } as CSSProperties}
      className={[
        "grid items-center gap-3 border-b border-hairline bg-surface-muted px-4 py-2.5 text-xs font-semibold text-muted",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/** 数据行，沿用与表头一致的列宽。 */
export function TableRow({
  columns,
  children,
  className,
}: {
  columns: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      style={{ gridTemplateColumns: columns } as CSSProperties}
      className={[
        "t-row grid items-center gap-3 border-b border-hairline-subtle px-4 py-3 text-sm transition-colors last:border-0 hover:bg-surface-subtle",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/** 跨整行的空状态占位。 */
export function TableEmpty({
  columns,
  children,
}: {
  columns: string;
  children?: ReactNode;
}): ReactElement {
  return (
    <div className="grid" style={{ gridTemplateColumns: columns } as CSSProperties}>
      <div className="col-span-full">
        {children ?? <EmptyState compact title="暂无数据" />}
      </div>
    </div>
  );
}
