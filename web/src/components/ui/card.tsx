import type { ReactElement, ReactNode } from "react";

type CardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** 默认 true；false 时内容区不加内边距（便于直接放表格）。 */
  padded?: boolean;
  className?: string;
  children: ReactNode;
};

/** 白卡容器：可选区块头（带品牌竖条）+ 内容区。无 title 时不渲染区块头。 */
export function Card({
  title,
  description,
  actions,
  padded = true,
  className,
  children,
}: CardProps): ReactElement {
  const hasHeader = Boolean(title);

  return (
    <section
      className={[
        "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {hasHeader ? (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 h-4 w-[3px] shrink-0 rounded-full bg-brand"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
              {description ? (
                <p className="mt-0.5 text-xs text-slate-500">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}

      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}
