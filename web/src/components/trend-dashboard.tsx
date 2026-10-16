"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { useTheme } from "./theme-provider";

export type TrendRecord = {
  periodStart: string;
  periodEnd: string;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  spend: number | null;
  revenue: number | null;
  roi: number | null;
};

export type TrendCompetitor = {
  id: number;
  name: string;
  platform: string;
  price: string | null;
  salesHint: string | null;
};

export type TrendSnapshot = {
  competitorId: number;
  checkedAt: string;
  price: number | null;
  salesHint: string | null;
};

export type TrendProduct = {
  id: number;
  name: string;
  platform: string;
  price: string | null;
  records: TrendRecord[];
  competitors: TrendCompetitor[];
  snapshots: TrendSnapshot[];
};

const METRICS = [
  { key: "conversions", label: "成交量", unit: "件" },
  { key: "clicks", label: "访客数", unit: "人" },
  { key: "impressions", label: "曝光量", unit: "次" },
  { key: "revenue", label: "成交额", unit: "元" },
  { key: "spend", label: "推广花费", unit: "元" },
  { key: "roi", label: "ROI", unit: "" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const SERIES_COLORS = ["#0891b2", "#059669", "#d97706", "#e11d48", "#0284c7", "#7c3aed"];
type Chart = ReturnType<typeof echarts.init>;

/** 读取当前主题下的 CSS 变量值（echarts 画在 canvas 上，CSS 变量管不到，必须 JS 取值）。 */
function readToken(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDay(iso: string): string {
  const day = iso.slice(0, 10);
  const parts = day.split("-");
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : day;
}

function formatValue(value: number, unit: string): string {
  if (unit === "元") return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
  if (unit === "") return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} ${unit}`;
}

/** 商品趋势看板：多商品投放时序叠加对照 + 竞品价格/销量提示对照。 */
export function TrendDashboard({ products }: { products: TrendProduct[] }) {
  const { theme } = useTheme();
  const [selectedIds, setSelectedIds] = useState<number[]>(() => products.slice(0, 2).map((p) => p.id));
  const [metric, setMetric] = useState<MetricKey>("conversions");
  const [baselineId, setBaselineId] = useState<number | null>(products[0]?.id ?? null);

  const metricDef = METRICS.find((item) => item.key === metric) ?? METRICS[0];
  const selected = useMemo(
    () => products.filter((product) => selectedIds.includes(product.id)),
    [products, selectedIds],
  );
  const baseline = useMemo(
    () => products.find((product) => product.id === baselineId) ?? selected[0] ?? products[0] ?? null,
    [products, baselineId, selected],
  );

  const trendRef = useRef<HTMLDivElement | null>(null);
  const trendChart = useRef<Chart | null>(null);
  const priceRef = useRef<HTMLDivElement | null>(null);
  const priceChart = useRef<Chart | null>(null);
  const snapshotRef = useRef<HTMLDivElement | null>(null);
  const snapshotChart = useRef<Chart | null>(null);

  useEffect(() => {
    const nodes = [trendRef.current, priceRef.current, snapshotRef.current];
    const charts = [trendChart, priceChart, snapshotChart];
    const observers = nodes.map((node, index) => {
      if (!node) return null;
      const chart = echarts.init(node);
      charts[index].current = chart;
      const observer = new ResizeObserver(() => chart.resize());
      observer.observe(node);
      return observer;
    });
    return () => {
      observers.forEach((observer) => observer?.disconnect());
      charts.forEach((chart) => {
        chart.current?.dispose();
        chart.current = null;
      });
    };
  }, []);

  // 主图：多商品投放时序叠加
  useEffect(() => {
    const chart = trendChart.current;
    if (!chart) return;
    if (selected.length === 0) {
      chart.clear();
      return;
    }

    const dates = Array.from(
      new Set(
        selected.flatMap((product) => product.records.map((record) => record.periodStart.slice(0, 10))),
      ),
    ).sort();
    const axis = dates.map(formatDay);

    const series = selected.map((product, index) => ({
      name: product.name,
      type: "line" as const,
      smooth: true,
      connectNulls: false,
      symbolSize: 6,
      itemStyle: { color: SERIES_COLORS[index % SERIES_COLORS.length] },
      lineStyle: { width: 2.5 },
      data: dates.map((date) => {
        const record = product.records.find((item) => item.periodStart.slice(0, 10) === date);
        return record ? toNumber(record[metric]) : null;
      }),
    }));

    chart.setOption({
      color: SERIES_COLORS,
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: unknown) =>
          typeof value === "number" ? formatValue(value, metricDef.unit) : "-",
      },
      legend: { top: 0, textStyle: { color: readToken("--t-ink-2", "#5C4A33"), fontSize: 12 } },
      grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: axis,
        axisLine: { lineStyle: { color: readToken("--t-line", "#E4D8C1") } },
        axisLabel: { color: readToken("--t-ink-3", "#8A7757"), fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: readToken("--t-ink-3", "#8A7757"), opacity: 0.35 } },
        axisLabel: { color: readToken("--t-ink-3", "#8A7757"), fontSize: 11 },
      },
      series,
    } satisfies echarts.EChartsCoreOption);
  }, [selected, metric, metricDef.unit, theme]);

  // 价格对照：本品 vs 竞品
  useEffect(() => {
    const chart = priceChart.current;
    if (!chart) return;
    if (!baseline) {
      chart.clear();
      return;
    }

    const names = [`本品 · ${baseline.name}`];
    const values: Array<number | null> = [toNumber(baseline.price)];
    baseline.competitors.forEach((competitor) => {
      names.push(competitor.name);
      values.push(toNumber(competitor.price));
    });

    chart.setOption({
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: unknown) => (typeof value === "number" ? `¥${value.toFixed(2)}` : "-"),
      },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: names,
        axisLabel: {
          color: readToken("--t-ink-3", "#8A7757"),
          fontSize: 11,
          interval: 0,
          formatter: (value: string) => (value.length > 8 ? `${value.slice(0, 8)}…` : value),
        },
        axisLine: { lineStyle: { color: readToken("--t-line", "#E4D8C1") } },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: readToken("--t-ink-3", "#8A7757"), opacity: 0.35 } },
        axisLabel: { color: readToken("--t-ink-3", "#8A7757"), fontSize: 11, formatter: "¥{value}" },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 34,
          itemStyle: { color: "#0891b2", borderRadius: [4, 4, 0, 0] },
          data: values.map((value, index) => ({
            value,
            itemStyle: { color: index === 0 ? "#0e7490" : "#94a3b8", borderRadius: [4, 4, 0, 0] },
          })),
        },
      ],
    } satisfies echarts.EChartsCoreOption);
  }, [baseline, theme]);

  // 竞品监控快照价格趋势（有快照才画）
  const snapshotSeries = useMemo(() => {
    if (!baseline || baseline.snapshots.length === 0) return [];
    const byCompetitor = new Map<number, string>();
    baseline.competitors.forEach((competitor) => byCompetitor.set(competitor.id, competitor.name));
    const dates = Array.from(new Set(baseline.snapshots.map((s) => s.checkedAt.slice(0, 10)))).sort();
    const ids = Array.from(new Set(baseline.snapshots.map((s) => s.competitorId)));
    return ids.map((competitorId, index) => ({
      name: byCompetitor.get(competitorId) ?? `竞品 #${competitorId}`,
      type: "line" as const,
      smooth: true,
      symbolSize: 6,
      itemStyle: { color: SERIES_COLORS[(index + 1) % SERIES_COLORS.length] },
      data: dates.map((date) => {
        const hit = baseline.snapshots.find(
          (s) => s.competitorId === competitorId && s.checkedAt.slice(0, 10) === date,
        );
        return hit ? hit.price : null;
      }),
    }));
  }, [baseline]);

  useEffect(() => {
    const chart = snapshotChart.current;
    if (!chart) return;
    if (snapshotSeries.length === 0 || !baseline) {
      chart.clear();
      return;
    }
    const dates = Array.from(new Set(baseline.snapshots.map((s) => s.checkedAt.slice(0, 10)))).sort();
    chart.setOption({
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: unknown) => (typeof value === "number" ? `¥${value.toFixed(2)}` : "-"),
      },
      legend: { top: 0, textStyle: { color: readToken("--t-ink-2", "#5C4A33"), fontSize: 12 } },
      grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: dates.map(formatDay),
        axisLine: { lineStyle: { color: readToken("--t-line", "#E4D8C1") } },
        axisLabel: { color: readToken("--t-ink-3", "#8A7757"), fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: readToken("--t-ink-3", "#8A7757"), opacity: 0.35 } },
        axisLabel: { color: readToken("--t-ink-3", "#8A7757"), fontSize: 11, formatter: "¥{value}" },
      },
      series: snapshotSeries,
    } satisfies echarts.EChartsCoreOption);
  }, [snapshotSeries, baseline, theme]);

  if (products.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="商品趋势" description="商品投放时序与竞品对照看板" />
        <Card>
          <EmptyState
            title="暂无可分析的商品"
            description="当前登录态下没有可用商品数据。请先在工作台创建商品并录入投放数据，再回到本页查看趋势。"
          />
        </Card>
      </div>
    );
  }

  const toggleProduct = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= 5
          ? current
          : [...current, id],
    );
  };

  const totalConversions = (product: TrendProduct) =>
    product.records.reduce((sum, record) => sum + (record.conversions ?? 0), 0);
  const latestRecord = (product: TrendProduct) =>
    [...product.records].sort((a, b) => a.periodStart.localeCompare(b.periodStart)).at(-1) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="商品趋势"
        description="选择多个商品叠加对照投放时序，并在下方与竞品做价格与销量对照"
      />

      <Card
        title="投放趋势对照"
        description={`纵轴：${metricDef.label}${metricDef.unit ? `（${metricDef.unit}）` : ""} · 最多同时对照 5 个商品`}
        padded={false}
      >
        <div className="flex flex-col gap-4 border-b border-hairline-subtle px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">指标</span>
            {METRICS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMetric(item.key)}
                className={buttonClass({
                  variant: item.key === metric ? "brand" : "default",
                  size: "sm",
                })}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">商品</span>
            {products.map((product) => {
              const active = selectedIds.includes(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggleProduct(product.id)}
                  className={buttonClass({ variant: active ? "primary" : "default", size: "sm" })}
                >
                  {product.name}
                  <span className="ml-1 text-[11px] opacity-70">{product.platform}</span>
                </button>
              );
            })}
          </div>
        </div>
        {selected.length === 0 ? (
          <div className="px-6 py-10">
            <EmptyState
              compact
              title="尚未选择商品"
              description="点击上方商品按钮，选择至少一个商品后即可查看趋势曲线。"
            />
          </div>
        ) : (
          <div ref={trendRef} className="h-[360px] w-full px-2 pb-3" />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="竞品价格对照"
          description="本品与竞品的当前售价对比（来自商品与竞品档案）"
          actions={
            <select
              value={baseline?.id ?? ""}
              onChange={(event) => setBaselineId(Number(event.target.value))}
              className="h-8 rounded-md border border-hairline bg-surface px-2 text-xs text-strong outline-none focus:border-brand"
              aria-label="选择对照基准商品"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          }
        >
          {baseline && baseline.competitors.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div ref={priceRef} className="h-[240px] w-full" />
              <ul className="flex flex-col divide-y divide-hairline-subtle">
                {[baseline, ...baseline.competitors].map((item, index) => {
                  const competitor = index === 0 ? null : baseline.competitors[index - 1];
                  const basePrice = toNumber(baseline.price);
                  const ownPrice = competitor ? toNumber(competitor.price) : basePrice;
                  const diff =
                    competitor && basePrice !== null && ownPrice !== null ? ownPrice - basePrice : null;
                  return (
                    <li
                      key={competitor?.id ?? `self-${baseline.id}`}
                      className="flex items-center gap-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-strong">
                        {index === 0 ? `本品 · ${baseline.name}` : competitor?.name}
                      </span>
                      <span className="shrink-0 text-body">
                        ¥{(ownPrice ?? 0).toFixed(2)}
                      </span>
                      {diff === null ? (
                        <Badge tone="neutral">无价格</Badge>
                      ) : diff === 0 ? (
                        <Badge tone="neutral">持平</Badge>
                      ) : diff > 0 ? (
                        <Badge tone="warning" className="gap-1">
                          <TrendingUp className="h-3 w-3" aria-hidden="true" />
                          贵 {diff.toFixed(2)}
                        </Badge>
                      ) : (
                        <Badge tone="success" className="gap-1">
                          <TrendingDown className="h-3 w-3" aria-hidden="true" />
                          便宜 {Math.abs(diff).toFixed(2)}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <EmptyState
              compact
              title={baseline ? "该商品尚未添加竞品" : "请先选择基准商品"}
              description="在商品详情页的「竞品列表」添加竞品后，这里会自动出现价格对照。"
            />
          )}
        </Card>

        <Card
          title="竞品销量与监控快照"
          description="竞品销量来自平台文案（sales_hint）；价格趋势仅在积累监控快照后可画"
        >
          {baseline && baseline.competitors.length > 0 ? (
            <div className="flex flex-col gap-4">
              <ul className="flex flex-col divide-y divide-hairline-subtle">
                {baseline.competitors.map((competitor) => {
                  const hint = competitor.salesHint?.trim();
                  return (
                    <li key={competitor.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate text-strong">{competitor.name}</span>
                      <span className="shrink-0 text-xs text-muted">{competitor.platform}</span>
                      {hint ? (
                        <Badge tone="brand">销量提示：{hint}</Badge>
                      ) : (
                        <Badge tone="neutral">暂无销量数据</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
              {snapshotSeries.length > 0 ? (
                <div ref={snapshotRef} className="h-[220px] w-full" />
              ) : (
                <EmptyState
                  compact
                  title="暂无监控快照"
                  description="在商品详情页为竞品创建监控后，每次抓取都会生成快照，这里会自动画出竞品价格趋势。"
                />
              )}
            </div>
          ) : (
            <EmptyState compact title="请先选择基准商品" description="选择基准商品后查看其竞品销量提示。" />
          )}
        </Card>
      </div>

      <Card title="所选商品汇总" description="累计成交量与最近一个投放周期" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-muted text-left text-xs font-semibold text-muted">
                <th className="px-6 py-2.5">商品</th>
                <th className="px-4 py-2.5">平台</th>
                <th className="px-4 py-2.5">售价</th>
                <th className="px-4 py-2.5">累计成交量</th>
                <th className="px-4 py-2.5">最近周期</th>
                <th className="px-4 py-2.5">最近 ROI</th>
              </tr>
            </thead>
            <tbody>
              {selected.map((product) => {
                const latest = latestRecord(product);
                const roi = latest?.roi ? Number(latest.roi) : null;
                return (
                  <tr key={product.id} className="border-b border-hairline-subtle last:border-0">
                    <td className="px-6 py-3 text-strong">{product.name}</td>
                    <td className="px-4 py-3 text-body">{product.platform}</td>
                    <td className="px-4 py-3 text-body">
                      {product.price ? `¥${Number(product.price).toFixed(2)}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-strong">
                      {totalConversions(product).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3 text-body">
                      {latest ? `${latest.periodStart.slice(0, 10)} ~ ${latest.periodEnd.slice(0, 10)}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {roi === null ? (
                        <span className="text-muted">-</span>
                      ) : (
                        <Badge tone={roi >= 1 ? "success" : "warning"}>{roi.toFixed(2)}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {selected.length === 0 ? (
          <div className="px-6 py-6">
            <EmptyState compact title="尚未选择商品" description="选择商品后此处展示汇总。" />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
