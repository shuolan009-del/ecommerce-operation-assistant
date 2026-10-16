"use client";

import { Bot, LayoutDashboard, Settings, Store as StoreIcon, TrendingUp, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import { ThemeToggle } from "./theme-toggle";

type ShellUser = { displayName: string };
type ShellStore = { id: string | number; name: string; platform: string };

type AppShellProps = {
  children: ReactNode;
  user?: ShellUser | null;
  stores?: ShellStore[];
  /** 演示模式：为 true 时在顶栏下方渲染全局横幅。 */
  demoMode?: boolean;
};

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "运营",
    items: [
      { href: "/", label: "工作台", icon: LayoutDashboard },
      { href: "/trends", label: "商品趋势", icon: TrendingUp },
      { href: "/imports", label: "数据导入", icon: Upload },
    ],
  },
  {
    label: "增长",
    items: [{ href: "/agent", label: "AI Agent", icon: Bot }],
  },
  {
    label: "系统",
    items: [{ href: "/settings", label: "模型配置", icon: Settings }],
  },
];

/** 不套后台壳的路径，直接透传 children。 */
const BARE_PATHS = ["/login", "/course-stage"];

/** 判断导航项是否处于选中态；根路径仅在完全相等时选中。 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 由 pathname 推导顶栏标题。 */
function resolveTitle(pathname: string): string {
  if (pathname === "/") return "工作台";
  if (pathname === "/trends" || pathname.startsWith("/trends/")) return "商品趋势";
  if (pathname === "/imports" || pathname.startsWith("/imports/")) return "数据导入";
  if (pathname === "/agent" || pathname.startsWith("/agent/")) return "AI Agent";
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "模型配置";
  if (pathname.startsWith("/products/")) return "商品详情";
  if (pathname.startsWith("/stores/")) return "店铺详情";
  return "工作台";
}

/** 商家后台式布局壳：深色侧栏 + 顶栏 + 内容区。 */
export function AppShell({ children, user, stores = [], demoMode = false }: AppShellProps): ReactElement {
  const pathname = usePathname();
  const safePathname = pathname ?? "/";

  if (BARE_PATHS.some((path) => safePathname === path || safePathname.startsWith(`${path}/`))) {
    return <>{children}</>;
  }

  const visibleStores = stores.slice(0, 8);
  const title = resolveTitle(safePathname);
  const initial = user?.displayName?.trim().slice(0, 1) || "商";

  const flatNav: NavItem[] = [
    ...NAV_GROUPS.flatMap((group) => group.items),
    ...visibleStores.map((store) => ({
      href: `/stores/${store.id}`,
      label: store.name,
      icon: StoreIcon,
    })),
  ];

  return (
    <div className="flex min-h-screen bg-page">
      {/* 侧栏：lg 及以上固定显示，sticky 不随内容滚动 */}
      <aside className="sticky top-0 hidden h-screen w-[var(--sidebar-width)] shrink-0 flex-col bg-sidebar lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-brand">
            {/* 嘉禾品牌标（与门户同源） */}
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <defs><linearGradient id="op-brand-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stopColor="#66BB6A"/><stop offset="1" stopColor="#A5D6A7"/></linearGradient></defs>
              <circle cx="24" cy="24" r="21" stroke="url(#op-brand-g)" strokeWidth="4" fill="none"/>
              <path d="M24 12 33 19v13H15V19l9-7z" fill="#B8823C"/>
              <path d="M24 40V26" stroke="#66BB6A" strokeWidth="2.6" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-strong">AI电商运营助手</p>
            <p className="truncate text-[11px] text-sidebar-fg">AI电商运营助手</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-3 first:mt-1">
              <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={isActive(safePathname, item.href)}
                  />
                ))}
              </ul>
            </div>
          ))}

          {visibleStores.length > 0 ? (
            <div className="mt-3">
              <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                店铺
              </p>
              <ul className="space-y-0.5">
                {visibleStores.map((store) => {
                  const href = `/stores/${store.id}`;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={sidebarLinkClass(isActive(safePathname, href))}
                      >
                        {isActive(safePathname, href) ? <ActiveBar /> : null}
                        <StoreIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{store.name}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted">
                          {store.platform}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] items-center justify-between gap-3 border-b border-hairline bg-surface px-4 lg:px-6">
          <h2 className="truncate text-sm font-semibold text-strong">{title}</h2>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href="http://127.0.0.1:5174/"
              target="_blank"
              rel="noopener"
              title="打开AI电商运营助手门户"
              className="hidden h-8 items-center rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-body transition-colors hover:border-brand hover:text-brand hover:bg-brand-soft sm:inline-flex"
            >
              返回门户
            </a>
            <input
              readOnly
              aria-label="搜索商品 / 订单"
              placeholder="搜索商品 / 订单"
              className="hidden h-8 w-48 rounded-md border border-hairline bg-surface-field px-3 text-xs text-muted outline-none md:block"
            />

            {user ? (
              <form action="/logout" method="post" className="flex items-center gap-2">
                <span className="hidden items-center gap-2 sm:flex">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                    {initial}
                  </span>
                  <span className="max-w-[160px] truncate text-sm text-body">
                    {user.displayName}
                  </span>
                </span>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-body transition-colors hover:bg-surface-subtle"
                >
                  退出
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-8 items-center rounded-md border border-hairline bg-surface px-3 text-xs font-medium text-body transition-colors hover:bg-surface-subtle"
              >
                登录
              </Link>
            )}
          </div>
        </header>

        {/* 演示模式横幅：提示当前为虚拟数据，并提供退出入口 */}
        {demoMode && (
          <div className="flex shrink-0 items-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning">
            <span className="font-medium">演示模式</span>
            <span className="text-muted">当前展示虚拟数据，非真实业务数据</span>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/demo/exit", { method: "POST" });
                window.location.reload();
              }}
              className="ml-auto rounded-md border border-hairline bg-surface px-2.5 py-1 text-xs text-body hover:bg-surface-subtle"
            >
              退出演示
            </button>
          </div>
        )}

        {/* lg 以下：横向可滚动导航条 */}
        <nav className="flex items-center gap-1 overflow-x-auto border-b border-hairline bg-surface px-3 py-2 lg:hidden">
          {flatNav.map((item) => {
            const active = isActive(safePathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-brand text-white"
                    : "text-body hover:bg-surface-subtle",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function ActiveBar(): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-[var(--t-sidebar-active-accent)]"
    />
  );
}

function sidebarLinkClass(active: boolean): string {
  return [
    "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
    active
      ? "bg-sidebar-active text-sidebar-fg-active"
      : "text-sidebar-fg hover:bg-surface-subtle hover:text-strong",
  ].join(" ");
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }): ReactElement {
  const Icon = item.icon;
  return (
    <li>
      <Link href={item.href} className={sidebarLinkClass(active)}>
        {active ? <ActiveBar /> : null}
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}
