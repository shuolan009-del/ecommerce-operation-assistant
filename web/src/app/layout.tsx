import type { Metadata } from "next";
import "./globals.css";

import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { getCurrentUser, getStores } from "@/lib/api";
import { getAuthToken, isDemoMode } from "@/lib/session";

export const metadata: Metadata = {
  title: "AI电商运营助手",
  description: "AI 单品运营工作台",
};

/** 渲染 RootLayout 组件，集中展示根布局所需的数据、状态和操作入口。 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 布局级数据只用于导航展示，任何异常都必须降级为未登录/无店铺，避免整站 500。
  let user: { displayName: string } | null = null;
  let stores: Array<{ id: number; name: string; platform: string }> = [];

  // 演示模式：由 Cookie 决定，用于渲染全局横幅并在客户端禁用写操作。
  const demoMode = await isDemoMode();

  try {
    const storeList = await getStores();
    stores = storeList.map((store) => ({
      id: store.id,
      name: store.name,
      platform: store.platform,
    }));

    const token = await getAuthToken();
    if (token) {
      const currentUser = await getCurrentUser(token);
      if (currentUser) {
        user = { displayName: currentUser.display_name };
      }
    }
  } catch {
    user = null;
    stores = [];
  }

  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        {/* 防 FOUC：首帧前同步写入 data-theme，与服务端渲染的 agri 默认值对不上时也不会闪 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k="jy-theme";var v=localStorage.getItem(k);if(v!=="agri"&&v!=="neu"){v="agri";}document.documentElement.setAttribute("data-theme",v);}catch(e){document.documentElement.setAttribute("data-theme","agri");}})();`,
          }}
        />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <AppShell user={user} stores={stores} demoMode={demoMode}>
            {children}
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
