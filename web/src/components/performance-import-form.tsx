import { Upload } from "lucide-react";

import { Button, Field, FormAlert, Input } from "@/components/ui";

type PerformanceImportFormProps = {
  canEdit?: boolean;
  productId: number;
};

/** 渲染 PerformanceImportForm 组件，集中展示经营数据导入表单所需的数据、状态和操作入口。 */
export function PerformanceImportForm({ canEdit = true, productId }: PerformanceImportFormProps) {
  if (!canEdit) {
    // 只读账号隐藏上传入口；服务端 route 仍会携带 token 调后端，由后端最终鉴权。
    return (
      <div>
        <h2 className="text-base font-semibold text-strong">批量导入数据</h2>
        <FormAlert tone="warning" className="mt-2">
          当前账号为只读权限，不能导入 CSV。
        </FormAlert>
      </div>
    );
  }

  return (
    <form
      action={`/products/${productId}/performance-records/import`}
      method="post"
      encType="multipart/form-data"
      className="space-y-4"
    >
      {/* CSV 上传走服务端 action，由 route 解析表格并转发给后端 bulk API，避免在客户端持有鉴权细节。 */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-600 text-white">
          <Upload className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-strong">批量导入数据</h2>
          <p className="text-sm text-body">上传 CSV，一次导入多天或多素材的投放表现</p>
        </div>
      </div>

      <Field label="CSV 文件">
        <Input
          name="csv_file"
          required
          type="file"
          accept=".csv,text/csv"
          className="file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
      </Field>

      <div className="rounded-md border border-hairline bg-surface-muted px-3 py-3 text-xs leading-5 text-body">
        <p className="font-medium text-strong">表头示例</p>
        <p className="mt-1 break-all">
          period_start, period_end, creative_plan_id, promotion_link_id, generated_asset_id, impressions, clicks, conversions, spend, revenue, notes
        </p>
      </div>

      <Button type="submit" variant="primary" className="w-full">
        <Upload className="h-4 w-4" aria-hidden="true" />
        导入 CSV
      </Button>
    </form>
  );
}
