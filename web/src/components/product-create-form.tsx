"use client";

import { Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Store } from "@/types";

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

type ProductCreateFormProps = {
  stores?: Store[];
};

/** 渲染 ProductCreateForm 组件，集中展示商品创建表单所需的数据、状态和操作入口。 */
export function ProductCreateForm({ stores = [] }: ProductCreateFormProps) {
  // 演示模式下禁用创建；在 effect 中读取 Cookie，避免 SSR 访问 document 报错与 hydration 不一致。
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    setIsDemo(document.cookie.includes(`${DEMO_MODE_COOKIE}=1`));
  }, []);

  return (
    <form action="/products/create" method="post" className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-strong">新建单品</h2>
          <p className="text-sm text-body">先把一个商品跑完整运营链路</p>
        </div>
      </div>

      <Field label="商品名称" required>
        <Input name="name" required placeholder="例如：低糖燕麦饼干" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="所属店铺">
          <Select name="store_id">
            <option value="">暂不绑定</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="平台">
          <Select name="platform" defaultValue="douyin">
            {platforms.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="类目">
          <Input name="category" placeholder="食品 / 家居 / 美妆" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="售价">
          <Input name="price" placeholder="29.90" inputMode="decimal" />
        </Field>

        <Field label="目标人群">
          <Input name="target_audience" placeholder="年轻上班族" />
        </Field>
      </div>

      <Field label="核心卖点">
        <Textarea name="selling_points" placeholder="用逗号或换行分隔，例如：低糖、饱腹、独立包装" />
      </Field>

      <Button
        type="submit"
        className="w-full"
        disabled={isDemo}
        title={isDemo ? "演示模式下不可创建" : undefined}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        创建商品
      </Button>
    </form>
  );
}
