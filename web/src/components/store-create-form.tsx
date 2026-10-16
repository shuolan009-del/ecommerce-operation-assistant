"use client";

import { Plus, Store as StoreIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Field, Input, Select } from "@/components/ui";

/** 演示模式 Cookie 名，与 `@/lib/session` 的 DEMO_MODE_COOKIE_NAME 保持一致。
 *  该模块依赖 next/headers（仅服务端可用），客户端组件不能直接导入，故此处写字面量。 */
const DEMO_MODE_COOKIE = "eo_demo_mode";

const platforms = [
  { label: "抖音电商", value: "douyin" },
  { label: "淘宝", value: "taobao" },
  { label: "天猫", value: "tmall" },
  { label: "拼多多", value: "pinduoduo" },
  { label: "京东", value: "jd" },
  { label: "TikTok Shop", value: "tiktok_shop" },
  { label: "Amazon", value: "amazon" },
  { label: "其他", value: "other" },
] as const;

/** 渲染 StoreCreateForm 组件，集中展示店铺创建表单所需的数据、状态和操作入口。 */
export function StoreCreateForm() {
  // 演示模式下禁用创建；在 effect 中读取 Cookie，避免 SSR 访问 document 报错与 hydration 不一致。
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    setIsDemo(document.cookie.includes(`${DEMO_MODE_COOKIE}=1`));
  }, []);

  return (
    <form action="/stores/create" method="post" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-soft text-brand">
          <StoreIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-strong">新建店铺</h2>
          <p className="text-sm text-body">为多平台商品、SKU 和库存建立归属</p>
        </div>
      </div>

      <Field label="店铺名称" required>
        <Input name="name" required placeholder="例如：抖音旗舰店" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="平台">
          <Select name="platform" defaultValue="douyin">
            {platforms.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="负责人">
          <Input name="owner_name" placeholder="运营负责人" />
        </Field>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isDemo}
        title={isDemo ? "演示模式下不可创建" : undefined}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        创建店铺
      </Button>
    </form>
  );
}
