import { NextResponse } from "next/server";

import { DEMO_MODE_COOKIE_NAME } from "@/lib/session";

/**
 * 退出演示模式：把演示模式 Cookie 置为 "0"。
 * 注意：必须 httpOnly=false，客户端表单组件要直接读该 Cookie 来决定是否禁用写按钮。
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_MODE_COOKIE_NAME, "0", {
    httpOnly: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
  return res;
}
