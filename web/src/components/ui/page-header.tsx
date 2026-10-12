import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

export type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
  className?: string;
};

/** 页面标题区：品牌竖条 + 标题 + 可选描述 / 面包屑 / 右侧操作。 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  className,
}: PageHeaderProps): ReactElement {
  return (
    <header
      className={[
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 ? (
          <nav
            aria-label="面包屑"
            className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500"
          >
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              const clickable = Boolean(crumb.href) && !isLast;
              return (
                <span
                  key={`${crumb.label}-${index}`}
                  className="inline-flex items-center gap-1.5"
                >
                  {index > 0 ? <span className="text-slate-300">/</span> : null}
                  {clickable ? (
                    <Link
                      href={crumb.href as string}
                      className="transition-colors hover:text-slate-700"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLast ? "text-slate-700" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        ) : null}

        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-4 w-[3px] shrink-0 rounded-full bg-brand"
          />
          <h1 className="truncate text-base font-semibold text-slate-950">{title}</h1>
        </div>

        {description ? (
          <p className="mt-1.5 pl-[13px] text-sm text-slate-500">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
