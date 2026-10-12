import type { Metadata } from "next";
import "./globals.css";

import { AppShell } from "@/components/app-shell";
import { getCurrentUser, getStores } from "@/lib/api";
import { getAuthToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "电商运营助手",
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
    >
      <body className="min-h-full">
        <AppShell user={user} stores={stores}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
