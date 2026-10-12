"use client";

import { Loader2, Upload } from "lucide-react";
import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  FormAlert,
  StatCard,
  StatCardGrid,
  TableEmpty,
  TableHead,
  TableRow,
  TableShell,
} from "@/components/ui";

type ImportRow = {
  row_number: number;
  status: "valid" | "created" | "error" | string;
  errors: string[];
  product_id: number | null;
  product_name: string | null;
  store_name: string | null;
  sku_code?: string | null;
  sku_name?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  record_id?: number | null;
  platform: string | null;
};

type ImportResult = {
  commit: boolean;
  total_rows: number;
  valid_rows: number;
  created_count: number;
  error_count: number;
  rows: ImportRow[];
};

type CsvImportPanelProps = {
  title: string;
  description: string;
  endpoint: string;
  fileLabel: string;
  itemLabel: string;
};

/** 导入结果表格列宽：行号 / 状态 / 条目 / 关联 / 错误。 */
const importColumns = "80px 90px 1fr 1fr 1.5fr";

/** 渲染 CsvImportPanel 组件，集中展示CSV导入面板所需的数据、状态和操作入口。 */
export function CsvImportPanel({
  title,
  description,
  endpoint,
  fileLabel,
  itemLabel,
}: CsvImportPanelProps) {
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 处理处理文件change交互，维护必要状态并把副作用交给受控路由或后端 API。 */
  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);
    setError(null);
    if (!file) {
      setCsvText("");
      return;
    }
    setCsvText(await file.text());
  }

  /** 处理提交导入交互，维护必要状态并把副作用交给受控路由或后端 API。 */
  async function submitImport(commit: boolean) {
    // 导入中心采用“预览 -> 确认导入”两段式，commit=false 不写库，避免表格错误直接污染数据。
    if (!csvText.trim()) {
      setError("请先选择商品 CSV 文件。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvText, commit }),
      });
      if (!response.ok) {
        throw new Error("导入请求失败");
      }
      // 后端返回逐行结果，前端只展示可导入/错误/已创建状态，不在浏览器端自行修正数据。
      setResult((await response.json()) as ImportResult);
    } catch {
      setError(`${itemLabel}导入失败，请确认已登录且账号有编辑权限。`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="default" onClick={() => submitImport(false)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            预览
          </Button>
          <Button
            variant="primary"
            onClick={() => submitImport(true)}
            disabled={loading || !result || result.valid_rows === 0}
          >
            确认导入
          </Button>
        </div>
      }
    >
      <label className="block rounded-md border border-dashed border-hairline bg-surface-muted px-4 py-6 text-center">
        <Upload className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
        <span className="mt-2 block text-sm font-medium text-body">{fileLabel}</span>
        <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="sr-only" />
      </label>

      {error ? (
        <FormAlert tone="error" className="mt-4">
          {error}
        </FormAlert>
      ) : null}

      {result ? (
        <div className="mt-5">
          <StatCardGrid>
            <StatCard label="总行数" value={result.total_rows} />
            <StatCard label="有效行" value={result.valid_rows} />
            <StatCard label="已创建" value={result.created_count} />
            <StatCard
              label="错误行"
              value={result.error_count}
              tone={result.error_count > 0 ? "danger" : "default"}
            />
          </StatCardGrid>

          <TableShell className="mt-4">
            <TableHead columns={importColumns}>
              <span>行号</span>
              <span>状态</span>
              <span>{itemLabel}</span>
              <span>关联</span>
              <span>错误</span>
            </TableHead>
            {result.rows.map((row) => (
              <TableRow key={row.row_number} columns={importColumns}>
                <span className="text-body">{row.row_number}</span>
                <div>
                  <Badge tone={row.status === "error" ? "danger" : "success"}>
                    {statusLabel(row.status)}
                  </Badge>
                </div>
                <span className="text-strong">{row.product_name ?? row.sku_name ?? "-"}</span>
                <span className="text-body">{relatedText(row)}</span>
                <span className="text-body">{row.errors.length > 0 ? row.errors.join("；") : "-"}</span>
              </TableRow>
            ))}
            {result.rows.length === 0 ? <TableEmpty columns={importColumns} /> : null}
          </TableShell>
        </div>
      ) : null}
    </Card>
  );
}

/** 渲染 ProductImportPanel 组件，集中展示商品导入面板所需的数据、状态和操作入口。 */
export function ProductImportPanel() {
  return (
    <CsvImportPanel
      title="商品 CSV 导入"
      description="先预览字段和错误行，确认后只导入有效商品行。"
      endpoint="/imports/products"
      fileLabel="选择商品 CSV 文件"
      itemLabel="商品"
    />
  );
}

/** 渲染 SkuInventoryImportPanel 组件，集中展示SKU库存导入面板所需的数据、状态和操作入口。 */
export function SkuInventoryImportPanel() {
  return (
    <CsvImportPanel
      title="SKU 库存 CSV 导入"
      description="按商品名称匹配已有商品，导入 SKU、初始库存、预警线和仓位。"
      endpoint="/imports/sku-inventory"
      fileLabel="选择 SKU 库存 CSV 文件"
      itemLabel="SKU"
    />
  );
}

/** 渲染 PerformanceImportCenterPanel 组件，集中展示经营数据导入中心面板所需的数据、状态和操作入口。 */
export function PerformanceImportCenterPanel() {
  return (
    <CsvImportPanel
      title="经营数据 CSV 导入"
      description="按商品名称或平台商品 ID 匹配商品，预览后导入曝光、点击、成交、花费和成交额。"
      endpoint="/imports/performance-records"
      fileLabel="选择经营数据 CSV 文件"
      itemLabel="经营数据"
    />
  );
}

/** 把状态状态映射为中文显示文本，保持页面口径一致。 */
function statusLabel(status: string): string {
  if (status === "valid") {
    return "可导入";
  }
  if (status === "created") {
    return "已创建";
  }
  if (status === "error") {
    return "错误";
  }
  return status;
}

/** 关联文本，封装当前页面重复使用的转换或展示规则，并统一处理空值边界。 */
function relatedText(row: ImportRow): string {
  if (row.store_name) {
    return row.store_name;
  }
  if (row.sku_code) {
    return row.sku_code;
  }
  if (row.period_start) {
    return `${row.period_start} 至 ${row.period_end ?? row.period_start}`;
  }
  if (row.record_id) {
    return `记录 #${row.record_id}`;
  }
  return "-";
}
