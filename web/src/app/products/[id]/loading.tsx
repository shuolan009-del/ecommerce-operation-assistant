import type { ReactElement } from "react";

/** 骨架块：统一灰底 + 呼吸动画，让加载态和真实内容的栅格节奏一致。 */
function Skeleton({ className }: { className: string }): ReactElement {
  return <div className={`animate-pulse rounded bg-surface-subtle ${className}`} />;
}

/** 商品详情页加载骨架：首屏要等商品、实验看板、Agent 记录、店铺和登录态五个接口，这里按真实栅格先占位，避免白屏。 */
export default function ProductDetailLoading(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
            <Skeleton className="h-3 w-12" />
            <span className="text-slate-300">/</span>
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="mt-2.5 pl-[13px]">
            <Skeleton className="h-3.5 w-40" />
          </div>
        </div>
        <Skeleton className="h-9 w-28 shrink-0 rounded-lg" />
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-3 sm:w-[480px]">
          {["售价", "竞品", "素材"].map((label) => (
            <div
              key={label}
              className="rounded-lg border border-hairline bg-surface p-4 shadow-card"
            >
              <p className="text-xs text-slate-500">{label}</p>
              <Skeleton className="mt-2.5 h-5 w-16" />
            </div>
          ))}
        </div>
      </div>

      <nav className="overflow-x-auto border-b border-hairline" aria-hidden="true">
        <div className="flex min-w-max gap-1">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="inline-flex h-11 items-center border-b-2 border-transparent px-4">
              <Skeleton className="h-3.5 w-14" />
            </div>
          ))}
        </div>
      </nav>

      <section className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
        <div className="flex flex-col gap-2 border-b border-hairline-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span aria-hidden="true" className="mt-0.5 h-4 w-[3px] shrink-0 rounded-full bg-brand" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-strong">单品运营流程</p>
              <Skeleton className="mt-1 h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-9 w-24 shrink-0 rounded-lg" />
        </div>

        <div className="grid gap-2 p-5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-hairline bg-surface p-3">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="grid gap-6">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-card"
            >
              <div className="border-b border-hairline-subtle px-4 py-3">
                <Skeleton className="h-3.5 w-24" />
              </div>
              <div className="space-y-3 p-5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
          <div className="border-b border-hairline-subtle px-4 py-3">
            <Skeleton className="h-3.5 w-28" />
          </div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-1/5" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
