import { BarChart3, Plus } from "lucide-react";

import type { AdExperiment, CreativePlan, GeneratedAsset, PromotionLink } from "@/types";

import { Button, Field, FormAlert, Input, Select, Textarea } from "@/components/ui";

type PerformanceRecordFormProps = {
  canEdit?: boolean;
  productId: number;
  creativePlans: CreativePlan[];
  generatedAssets: GeneratedAsset[];
  promotionLinks: PromotionLink[];
  adExperiments: AdExperiment[];
};

/** 渲染 PerformanceRecordForm 组件，集中展示经营数据record表单所需的数据、状态和操作入口。 */
export function PerformanceRecordForm({
  canEdit = true,
  productId,
  creativePlans,
  generatedAssets,
  promotionLinks,
  adExperiments,
}: PerformanceRecordFormProps) {
  if (!canEdit) {
    return (
      <div>
        <h2 className="text-base font-semibold text-strong">录入经营数据</h2>
        <FormAlert tone="warning" className="mt-2">
          当前账号为只读权限，不能录入经营数据。
        </FormAlert>
      </div>
    );
  }

  const sortedCreativePlans = [...creativePlans].sort((a, b) => {
    const statusRank = { selected: 0, draft: 1, archived: 2 };
    return statusRank[a.status] - statusRank[b.status] || b.id - a.id;
  });

  return (
    <form action={`/products/${productId}/performance-records/create`} method="post" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-600 text-white">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-strong">录入经营数据</h2>
          <p className="text-sm text-body">曝光、点击、成交和花费会自动计算 CTR、转化率和 ROI</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="开始日期">
          <Input name="period_start" required type="date" />
        </Field>

        <Field label="结束日期">
          <Input name="period_end" required type="date" />
        </Field>
      </div>

      <Field label="关联素材">
        <Select name="creative_plan_id">
          <option value="">不关联素材</option>
          {sortedCreativePlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.status === "selected" ? "已选中 · " : ""}
              {plan.type === "main_image" ? "主图" : "视频"} · {plan.title}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="关联投放实验">
        <Select name="ad_experiment_id">
          <option value="">不关联实验</option>
          {adExperiments.map((experiment) => (
            <option key={experiment.id} value={experiment.id}>
              {experiment.status === "active" ? "执行中 · " : ""}
              {experiment.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="关联链接">
        <Select name="promotion_link_id">
          <option value="">不关联链接</option>
          {promotionLinks.map((link) => (
            <option key={link.id} value={link.id}>
              {link.label} · {link.scenario || link.link_type}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="关联生成素材">
        <Select name="generated_asset_id">
          <option value="">不关联生成素材</option>
          {generatedAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.asset_type === "video" ? "视频" : "图片"} · {asset.title || asset.url}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput name="impressions" label="曝光" placeholder="10000" />
        <NumberInput name="clicks" label="点击" placeholder="420" />
        <NumberInput name="conversions" label="成交" placeholder="18" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput name="spend" label="花费" placeholder="300.00" decimal />
        <NumberInput name="revenue" label="成交金额" placeholder="980.00" decimal />
      </div>

      <Field label="备注">
        <Textarea name="notes" placeholder="可记录素材版本、投放人群、活动价等上下文" />
      </Field>

      <Button type="submit" variant="primary" className="w-full">
        <Plus className="h-4 w-4" aria-hidden="true" />
        保存数据
      </Button>
    </form>
  );
}

/** 渲染 NumberInput 组件，集中展示数值input所需的数据、状态和操作入口。 */
function NumberInput({
  name,
  label,
  placeholder,
  decimal = false,
}: {
  name: string;
  label: string;
  placeholder: string;
  decimal?: boolean;
}) {
  return (
    <Field label={label}>
      <Input name={name} inputMode={decimal ? "decimal" : "numeric"} placeholder={placeholder} />
    </Field>
  );
}
