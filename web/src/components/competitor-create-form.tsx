import { LinkIcon, Plus } from "lucide-react";

import { Button, Field, FormAlert, Input, Select, Textarea } from "@/components/ui";

type CompetitorCreateFormProps = {
  canEdit?: boolean;
  productId: number;
};

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

/** 渲染 CompetitorCreateForm 组件，集中展示竞品创建表单所需的数据、状态和操作入口。 */
export function CompetitorCreateForm({ canEdit = true, productId }: CompetitorCreateFormProps) {
  if (!canEdit) {
    return <ReadOnlyFormNote title="添加竞品" />;
  }

  return (
    <form action={`/products/${productId}/competitors/create`} method="post" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-600 text-white">
          <LinkIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-strong">添加竞品</h2>
          <p className="text-sm text-body">先录入 3-10 个竞品，后面用于 AI 对比分析</p>
        </div>
      </div>

      <Field label="竞品名称">
        <Input name="name" required placeholder="例如：同类爆款饼干" />
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

        <Field label="售价">
          <Input name="price" inputMode="decimal" placeholder="39.90" />
        </Field>
      </div>

      <Field label="竞品链接">
        <Input name="url" type="url" placeholder="https://..." />
      </Field>

      <Field label="标题/销量提示">
        <Input name="title" placeholder="可粘贴商品标题或销量提示" />
      </Field>

      <Field label="卖点关键词">
        <Textarea name="selling_points" placeholder="用逗号或换行分隔，例如：低价、大规格、买一送一" />
      </Field>

      <Button type="submit" variant="primary" className="w-full">
        <Plus className="h-4 w-4" aria-hidden="true" />
        添加竞品
      </Button>
    </form>
  );
}

/** 渲染 ReadOnlyFormNote 组件，集中展示读取only表单note所需的数据、状态和操作入口。 */
function ReadOnlyFormNote({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-strong">{title}</h2>
      <FormAlert tone="warning" className="mt-2">
        当前账号为只读权限，不能新增或导入数据。
      </FormAlert>
    </div>
  );
}
