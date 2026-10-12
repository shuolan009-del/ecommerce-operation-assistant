import type { ReviewReport } from "@/types";

import { Button, Field, Input, Textarea } from "@/components/ui";

type ReviewReportEditFormProps = {
  productId: number;
  report: ReviewReport;
};

/** 渲染 ReviewReportEditForm 组件，集中展示复盘报告编辑表单所需的数据、状态和操作入口。 */
export function ReviewReportEditForm({ productId, report }: ReviewReportEditFormProps) {
  return (
    <form
      action={`/products/${productId}/review-reports/${report.id}/update`}
      method="post"
      className="mt-4 grid gap-3 border-t border-hairline pt-4"
    >
      {/* 复盘是周期性经营记录，允许人工修正日期和行动项，后续分析才不会被一次 AI 总结锁死。 */}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="周期开始">
          <Input name="period_start" type="date" defaultValue={report.period_start} />
        </Field>
        <Field label="周期结束">
          <Input name="period_end" type="date" defaultValue={report.period_end} />
        </Field>
      </div>

      <Field label="复盘总结">
        <Textarea name="summary" defaultValue={report.summary} rows={3} />
      </Field>

      <div className="grid gap-3 md:grid-cols-2">
        <ListField label="复盘洞察" name="insights" items={report.insights} />
        <ListField label="下一步动作" name="next_actions" items={report.next_actions} />
      </div>

      <Button type="submit" variant="primary">
        保存复盘
      </Button>
    </form>
  );
}

/** 渲染 ListField 组件，集中展示列表字段所需的数据、状态和操作入口。 */
function ListField({
  label,
  name,
  items,
}: {
  label: string;
  name: string;
  items: string[];
}) {
  return (
    <Field label={label}>
      <Textarea name={name} defaultValue={items.join("\n")} rows={5} />
    </Field>
  );
}
