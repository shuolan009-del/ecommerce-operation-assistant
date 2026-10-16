import { ScanSearch } from "lucide-react";

import { Button, Field, FormAlert, Input, Select } from "@/components/ui";

type CompetitorUrlImportFormProps = {
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

/** 渲染 CompetitorUrlImportForm 组件，集中展示竞品URL导入表单所需的数据、状态和操作入口。 */
export function CompetitorUrlImportForm({ canEdit = true, productId }: CompetitorUrlImportFormProps) {
  if (!canEdit) {
    return (
      <div>
        <h2 className="text-base font-semibold text-strong">创建竞品解析任务</h2>
        <FormAlert tone="warning" className="mt-2">
          当前账号为只读权限，不能创建解析任务。
        </FormAlert>
      </div>
    );
  }

  return (
    <form action={`/products/${productId}/competitors/import-url`} method="post" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-white">
          <ScanSearch className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-strong">创建竞品解析任务</h2>
          <p className="text-sm text-body">提交公开商品页，后台解析标题、价格、主图和卖点关键词</p>
        </div>
      </div>

      <Field label="竞品链接">
        <Input name="url" required type="url" placeholder="https://..." />
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

      <Button type="submit" variant="primary" className="w-full">
        <ScanSearch className="h-4 w-4" aria-hidden="true" />
        创建解析任务
      </Button>
    </form>
  );
}
