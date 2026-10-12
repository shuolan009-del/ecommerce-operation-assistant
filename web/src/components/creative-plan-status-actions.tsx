import type { CreativePlan } from "@/types";

import { Badge, Button } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";

type CreativePlanStatusActionsProps = {
  canEdit?: boolean;
  plan: CreativePlan;
  productId: number;
  tab: "main-images" | "video";
};

/** 渲染 CreativePlanStatusActions 组件，集中展示创意方案状态actions所需的数据、状态和操作入口。 */
export function CreativePlanStatusActions({ canEdit = true, plan, productId, tab }: CreativePlanStatusActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={statusTone(plan.status)}>{statusLabel(plan.status)}</Badge>
      {!canEdit ? null : (
      // 状态切换只是运营筛选方案，不会自动生成素材或创建投放实验；后端仍会校验编辑权限。
      <form
        action={`/products/${productId}/creative-plans/${plan.id}/status/update`}
        method="post"
        className="flex flex-wrap gap-1"
      >
        <input type="hidden" name="tab" value={tab} />
        {plan.status !== "selected" ? (
          <Button type="submit" name="status" value="selected" size="sm" variant="primary">
            选中
          </Button>
        ) : null}
        {plan.status !== "archived" ? (
          <Button type="submit" name="status" value="archived" size="sm" variant="default">
            归档
          </Button>
        ) : null}
        {plan.status !== "draft" ? (
          <Button type="submit" name="status" value="draft" size="sm" variant="text">
            草稿
          </Button>
        ) : null}
      </form>
      )}
    </div>
  );
}

/** 把状态状态映射为中文显示文本，保持页面口径一致。 */
function statusLabel(status: CreativePlan["status"]): string {
  const labels: Record<CreativePlan["status"], string> = {
    draft: "草稿",
    selected: "已选中",
    archived: "已归档",
  };
  return labels[status];
}

/** 把状态状态映射为视觉样式，避免组件内散落条件分支。 */
function statusTone(status: CreativePlan["status"]): BadgeTone {
  const tones: Record<CreativePlan["status"], BadgeTone> = {
    draft: "neutral",
    selected: "success",
    archived: "neutral",
  };
  return tones[status];
}
