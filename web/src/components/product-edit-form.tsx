import { Save } from "lucide-react";

import type { ProductDetail } from "@/types";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";

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

type ProductEditFormProps = {
  canEdit?: boolean;
  product: ProductDetail;
};

/** 渲染 ProductEditForm 组件，集中展示商品编辑表单所需的数据、状态和操作入口。 */
export function ProductEditForm({ canEdit = true, product }: ProductEditFormProps) {
  return (
    <form action={`/products/${product.id}/update`} method="post" className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-strong">商品信息</h2>
        <p className="mt-1 text-sm text-body">调整基础信息后，再重新生成诊断和素材方向</p>
      </div>

      <Field label="商品名称">
        <Input name="name" required defaultValue={product.name} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="平台">
          <Select name="platform" defaultValue={product.platform}>
            {platforms.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="类目">
          <Input name="category" defaultValue={product.category ?? ""} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="售价">
          <Input name="price" inputMode="decimal" defaultValue={product.price ?? ""} />
        </Field>

        <Field label="成本">
          <Input name="cost" inputMode="decimal" defaultValue={product.cost ?? ""} />
        </Field>
      </div>

      <Field label="目标人群">
        <Input name="target_audience" defaultValue={product.target_audience ?? ""} />
      </Field>

      <Field label="核心卖点">
        <Textarea name="selling_points" defaultValue={product.selling_points.join("\n")} rows={4} />
      </Field>

      <Field label="商品链接">
        <Input name="product_url" defaultValue={product.product_url ?? ""} />
      </Field>

      {canEdit ? (
        <Button type="submit" variant="primary" className="w-full">
          <Save className="h-4 w-4" aria-hidden="true" />
          保存商品
        </Button>
      ) : null}
    </form>
  );
}
