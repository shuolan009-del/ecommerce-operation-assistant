import { getProduct, getProducts } from "@/lib/api";
import type { ProductDetail } from "@/types";

import {
  TrendDashboard,
  type TrendCompetitor,
  type TrendProduct,
  type TrendRecord,
  type TrendSnapshot,
} from "@/components/trend-dashboard";

export const metadata = {
  title: "商品趋势 · AI电商运营助手",
};

/** 把商品详情压平成看板需要的最小数据集，避免把生成任务等大对象传给客户端。 */
function toTrendProduct(detail: ProductDetail): TrendProduct {
  const records: TrendRecord[] = [...detail.performance_records]
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .map((record) => ({
      periodStart: record.period_start,
      periodEnd: record.period_end,
      impressions: record.impressions,
      clicks: record.clicks,
      conversions: record.conversions,
      spend: record.spend === null ? null : Number(record.spend),
      revenue: record.revenue === null ? null : Number(record.revenue),
      roi: record.roi === null ? null : Number(record.roi),
    }));

  const competitors: TrendCompetitor[] = detail.competitors.map((competitor) => ({
    id: competitor.id,
    name: competitor.name,
    platform: competitor.platform,
    price: competitor.price,
    salesHint: competitor.sales_hint,
  }));

  const snapshots: TrendSnapshot[] = detail.competitor_monitors.flatMap((monitor) =>
    monitor.snapshots.map((snapshot) => ({
      competitorId: snapshot.competitor_id,
      checkedAt: snapshot.checked_at,
      price: snapshot.price === null ? null : Number(snapshot.price),
      salesHint: snapshot.sales_hint,
    })),
  );

  return {
    id: detail.id,
    name: detail.name,
    platform: detail.platform,
    price: detail.price,
    records,
    competitors,
    snapshots,
  };
}

/** 渲染商品趋势页面；在服务端聚合各商品的投放时序与竞品档案，交互交给看板客户端组件。 */
export default async function TrendsPage() {
  const products = await getProducts();
  // 每个商品一次详情请求；商品数量级为个位数到几十，串行会慢，这里并行取。
  const details = await Promise.all(products.map((product) => getProduct(String(product.id))));
  const dataset = details.filter((detail): detail is ProductDetail => detail !== null).map(toTrendProduct);

  return <TrendDashboard products={dataset} />;
}
