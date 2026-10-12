import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InventoryAdvicePanel } from "@/components/inventory-advice-panel";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  StatCardGrid,
  TableEmpty,
  TableHead,
  TableRow,
  buttonClass,
} from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { getCurrentUser, getProducts, getStore, getStoreInventoryMovements, getStoreInventorySummary } from "@/lib/api";
import { getAuthToken } from "@/lib/session";
import type { StoreInventoryMovementRow, StoreInventoryRow } from "@/types";
import type { Platform, Product } from "@/types";

const platformLabels: Record<Platform, string> = {
  douyin: "抖音",
  taobao: "淘宝",
  tmall: "天猫",
  pinduoduo: "拼多多",
  jd: "京东",
  tiktok_shop: "TikTok",
  amazon: "Amazon",
  other: "其他",
};

const PRODUCT_COLUMNS = "1.4fr 0.8fr 0.8fr 1fr 96px";
const INVENTORY_COLUMNS = "1.2fr 0.9fr 0.7fr 0.7fr 0.7fr 0.8fr";
const MOVEMENT_COLUMNS = "0.8fr 1fr 0.9fr 0.7fr 0.7fr 1fr";

type StorePageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ inventory?: string }>;
};

/** 渲染stores页面；在服务端加载业务数据，并把交互交给对应表单或客户端组件。 */
export default async function StorePage({ params, searchParams }: StorePageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const [store, products, inventorySummary, inventoryMovements, token] = await Promise.all([
    getStore(id),
    getProducts(),
    getStoreInventorySummary(id),
    getStoreInventoryMovements(id),
    getAuthToken(),
  ]);

  if (!store) {
    notFound();
  }

  const storeProducts = products.filter((product) => product.store_id === store.id);
  const activeProducts = storeProducts.filter((product) => product.platform_status !== "offline").length;
  const unmappedProducts = storeProducts.filter((product) => !product.external_product_id).length;
  const lowStockRows = inventorySummary?.rows.filter((row) => row.is_low_stock) ?? [];
  const inventoryRows = query.inventory === "low" ? lowStockRows : inventorySummary?.rows ?? [];
  const workflowSteps = buildStoreWorkflowSteps(store.id, storeProducts, inventorySummary?.rows ?? [], lowStockRows, unmappedProducts);
  const currentUser = token ? await getCurrentUser(token) : null;
  const canEdit = Boolean(currentUser?.permissions.can_edit);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={store.name}
        description={`${platformLabels[store.platform]} · ${
          store.owner_name ? `负责人：${store.owner_name}` : "未设置负责人"
        }`}
        crumbs={[{ label: "工作台", href: "/" }, { label: store.name }]}
        actions={
          <Badge tone={storeStatusTone(store.status)}>{storeStatusLabel(store.status)}</Badge>
        }
      />

      <StatCardGrid>
        <StatCard label="店铺商品" value={storeProducts.length} />
        <StatCard label="在营商品" value={activeProducts} />
        <StatCard
          label="待补平台映射"
          value={unmappedProducts}
          tone={unmappedProducts > 0 ? "warning" : "default"}
        />
        <StatCard label="可用库存" value={inventorySummary?.total_available_quantity ?? 0} />
      </StatCardGrid>

      <StoreWorkflowPanel steps={workflowSteps} />

      {lowStockRows.length > 0 ? (
        <section className="rounded-lg border border-warning/30 bg-warning-soft p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-warning">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-strong">库存异常提示</h2>
                <p className="mt-1 text-sm text-amber-900">
                  {lowStockRows.length} 个 SKU 可用库存已低于或等于预警线，建议优先补货或调整投放节奏。
                </p>
              </div>
            </div>
            <Link
              href={`/stores/${store.id}?inventory=low`}
              className={buttonClass({ variant: "primary" })}
            >
              只看低库存
            </Link>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {lowStockRows.slice(0, 4).map((row) => (
              <Link
                key={row.sku_id}
                href={`/products/${row.product_id}?tab=overview`}
                className="rounded-md border border-warning/30 bg-surface px-3 py-2 text-sm hover:bg-amber-50"
              >
                <span className="font-medium text-strong">{row.product_name}</span>
                <span className="ml-2 text-body">{row.sku_code}</span>
                <span className="ml-2 text-warning">可用 {row.available_quantity}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <InventoryWorkflowPanel storeId={store.id} inventoryRows={inventorySummary?.rows ?? []} lowStockRows={lowStockRows} />

      <InventoryAdvicePanel storeId={store.id} canEdit={canEdit} />

      <Card
        title="店铺商品"
        description="从店铺维度进入单品运营闭环"
        actions={
          <Link href={`/?store=${store.id}`} className={buttonClass({ variant: "default" })}>
            回首页筛选
          </Link>
        }
        padded={false}
      >
        <TableHead columns={PRODUCT_COLUMNS}>
          <span>商品</span>
          <span>平台状态</span>
          <span>售价</span>
          <span>卖点</span>
          <span>动作</span>
        </TableHead>
        {storeProducts.length === 0 ? (
          <TableEmpty columns={PRODUCT_COLUMNS}>
            <EmptyState
              compact
              title="这个店铺还没有绑定商品，可以回到首页创建商品并选择该店铺。"
            />
          </TableEmpty>
        ) : (
          storeProducts.map((product) => <StoreProductRow key={product.id} product={product} />)
        )}
      </Card>

      <Card
        title="库存概览"
        description="按 SKU 汇总库存、锁定量、可用量和低库存风险"
        actions={<Badge tone={lowStockRows.length > 0 ? "warning" : "neutral"}>低库存 {inventorySummary?.low_stock_count ?? 0}</Badge>}
        padded={false}
      >
        <div className="flex flex-wrap gap-2 border-b border-hairline-subtle px-4 py-3">
          <Link
            href={`/stores/${store.id}`}
            className={buttonClass({
              variant: query.inventory === "low" ? "default" : "brand",
              size: "sm",
            })}
          >
            全部库存
          </Link>
          <Link
            href={`/stores/${store.id}?inventory=low`}
            className={buttonClass({
              variant: query.inventory === "low" ? "brand" : "default",
              size: "sm",
            })}
          >
            低库存
          </Link>
        </div>

        <TableHead columns={INVENTORY_COLUMNS}>
          <span>SKU</span>
          <span>商品</span>
          <span>现货</span>
          <span>锁定</span>
          <span>可用</span>
          <span>状态</span>
        </TableHead>
        {!inventorySummary || inventoryRows.length === 0 ? (
          <TableEmpty columns={INVENTORY_COLUMNS}>
            <EmptyState
              compact
              title={
                query.inventory === "low"
                  ? "当前没有低库存 SKU。"
                  : "这个店铺还没有 SKU 库存数据，后续可从商品详情创建 SKU 并登记库存。"
              }
            />
          </TableEmpty>
        ) : (
          inventoryRows.map((row) => <InventoryRow key={row.sku_id} row={row} />)
        )}
      </Card>

      <Card
        title="库存流水"
        description="集中查看店铺最近库存变化"
        actions={<Badge tone="neutral">最近 {inventoryMovements.length}</Badge>}
        padded={false}
      >
        <TableHead columns={MOVEMENT_COLUMNS}>
          <span>类型</span>
          <span>商品</span>
          <span>SKU</span>
          <span>现货变化</span>
          <span>锁定变化</span>
          <span>原因</span>
        </TableHead>
        {inventoryMovements.length === 0 ? (
          <TableEmpty columns={MOVEMENT_COLUMNS}>
            <EmptyState compact title="暂无库存流水。" />
          </TableEmpty>
        ) : (
          inventoryMovements.map((movement) => (
            <InventoryMovementRow key={movement.id} movement={movement} />
          ))
        )}
      </Card>
    </div>
  );
}

/** 把店铺状态映射为徽标色调，保持页面口径一致。 */
function storeStatusTone(status: string): BadgeTone {
  if (status === "active") {
    return "success";
  }
  if (status === "paused") {
    return "warning";
  }
  return "danger";
}

/** 把店铺状态映射为中文显示文本，保持页面口径一致。 */
function storeStatusLabel(status: string): string {
  if (status === "active") {
    return "启用";
  }
  if (status === "paused") {
    return "暂停";
  }
  return "关闭";
}

/** 把平台状态映射为徽标色调；未知取值回落到中性，不臆测后端语义。 */
function platformStatusTone(status: string | null): BadgeTone {
  const normalized = status?.toLowerCase();
  if (!normalized) {
    return "neutral";
  }
  if (["on_sale", "on sale", "active", "online", "上架"].includes(normalized)) {
    return "success";
  }
  if (["offline", "closed", "removed", "下架"].includes(normalized)) {
    return "danger";
  }
  if (["draft", "pending", "草稿"].includes(normalized)) {
    return "neutral";
  }
  return "neutral";
}

type StoreWorkflowStep = {
  key: string;
  title: string;
  href: string;
  done: boolean;
  hint: string;
};

/** 渲染 StoreWorkflowPanel 组件，集中展示店铺工作流面板所需的数据、状态和操作入口。 */
function StoreWorkflowPanel({ steps }: { steps: StoreWorkflowStep[] }) {
  const nextStep = steps.find((step) => !step.done) ?? steps[steps.length - 1];

  return (
    <Card
      title="店铺运营流程"
      description={nextStep.done ? "店铺基础流程已跑通。" : `下一步：${nextStep.title}`}
      actions={
        <Link href={nextStep.href} className={buttonClass({ variant: "primary" })}>
          继续处理
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
    >
      <div className="grid gap-2 md:grid-cols-5">
        {steps.map((step) => (
          <Link
            key={step.key}
            href={step.href}
            className={`rounded-md border px-3 py-3 transition ${
              step.done
                ? "border-success/20 bg-success-soft"
                : "border-hairline bg-surface hover:bg-surface-subtle"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-strong">{step.title}</p>
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-body">{step.hint}</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/** 构建店铺工作流steps，从现有业务数据推导稳定的页面展示模型，不在渲染阶段修改源数据。 */
function buildStoreWorkflowSteps(
  storeId: number,
  products: Product[],
  inventoryRows: StoreInventoryRow[],
  lowStockRows: StoreInventoryRow[],
  unmappedProducts: number,
): StoreWorkflowStep[] {
  return [
    {
      key: "store",
      title: "建店",
      href: `/stores/${storeId}`,
      done: true,
      hint: "店铺档案已创建",
    },
    {
      key: "products",
      title: "商品",
      href: `/?store=${storeId}`,
      done: products.length > 0,
      hint: products.length > 0 ? `${products.length} 个商品已归属店铺` : "创建或导入商品",
    },
    {
      key: "inventory",
      title: "SKU/库存",
      href: `/stores/${storeId}`,
      done: inventoryRows.length > 0,
      hint: inventoryRows.length > 0 ? `${inventoryRows.length} 个 SKU 有库存记录` : "进入商品维护 SKU 和库存",
    },
    {
      key: "mapping",
      title: "数据映射",
      href: "/imports",
      done: products.length > 0 && unmappedProducts === 0,
      hint: unmappedProducts > 0 ? `${unmappedProducts} 个商品待补平台映射` : "导入经营数据或字段映射",
    },
    {
      key: "risk",
      title: "异常处理",
      href: lowStockRows.length > 0 ? `/stores/${storeId}?inventory=low` : `/stores/${storeId}`,
      done: inventoryRows.length > 0 && lowStockRows.length === 0,
      hint: lowStockRows.length > 0 ? `${lowStockRows.length} 个 SKU 低库存` : "库存异常入口",
    },
  ];
}

/** 渲染 InventoryWorkflowPanel 组件，集中展示库存工作流面板所需的数据、状态和操作入口。 */
function InventoryWorkflowPanel({
  storeId,
  inventoryRows,
  lowStockRows,
}: {
  storeId: number;
  inventoryRows: StoreInventoryRow[];
  lowStockRows: StoreInventoryRow[];
}) {
  const hasInventory = inventoryRows.length > 0;
  const hasLowStock = lowStockRows.length > 0;
  const steps = [
    {
      title: "发现低库存",
      done: hasInventory,
      hint: hasLowStock ? `${lowStockRows.length} 个 SKU 需要处理` : "当前无低库存风险",
      href: hasLowStock ? `/stores/${storeId}?inventory=low` : `/stores/${storeId}`,
    },
    {
      title: "分析销量",
      done: false,
      hint: "导入经营数据后判断补货优先级",
      href: "/imports",
    },
    {
      title: "生成建议",
      done: false,
      hint: "使用库存异常 AI/规则建议",
      href: `/stores/${storeId}`,
    },
    {
      title: "人工确认",
      done: !hasLowStock && hasInventory,
      hint: "补货、调拨和投放节奏由人工确认",
      href: `/stores/${storeId}`,
    },
  ];

  return (
    <Card
      title="库存处理流程"
      description="围绕低库存、销量数据、补货建议和人工确认推进"
      actions={
        <Link
          href={hasLowStock ? `/stores/${storeId}?inventory=low` : "/imports"}
          className={buttonClass({ variant: "default" })}
        >
          {hasLowStock ? "查看低库存" : "导入经营数据"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
    >
      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((step) => (
          <Link
            key={step.title}
            href={step.href}
            className={`rounded-md border px-3 py-3 transition ${
              step.done
                ? "border-success/20 bg-success-soft"
                : "border-hairline bg-surface hover:bg-surface-subtle"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-strong">{step.title}</p>
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-body">{step.hint}</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/** 渲染 StoreProductRow 组件，集中展示店铺商品行所需的数据、状态和操作入口。 */
function StoreProductRow({ product }: { product: Product }) {
  return (
    <TableRow columns={PRODUCT_COLUMNS}>
      <div>
        <p className="font-medium text-strong">{product.name}</p>
        <p className="mt-1 text-xs text-body">{product.category ?? "未分类"}</p>
      </div>
      <Badge tone={platformStatusTone(product.platform_status)} className="w-fit">
        {product.platform_status ?? "未同步"}
      </Badge>
      <span className="font-medium text-slate-800">{product.price ? `¥${product.price}` : "-"}</span>
      <div className="flex flex-wrap gap-1.5">
        {product.selling_points.slice(0, 3).map((point) => (
          <Badge key={point} tone="success">
            {point}
          </Badge>
        ))}
      </div>
      <Link
        href={`/products/${product.id}`}
        className={buttonClass({ variant: "default", size: "sm" })}
      >
        进入
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </TableRow>
  );
}

/** 渲染 InventoryRow 组件，集中展示库存行所需的数据、状态和操作入口。 */
function InventoryRow({ row }: { row: StoreInventoryRow }) {
  return (
    <TableRow columns={INVENTORY_COLUMNS}>
      <div>
        <p className="font-medium text-strong">{row.sku_name}</p>
        <p className="mt-1 text-xs text-body">{row.sku_code}</p>
      </div>
      <span className="text-body">{row.product_name}</span>
      <span className="font-medium text-slate-800">{row.quantity}</span>
      <span className="text-body">{row.locked_quantity}</span>
      <span className="font-medium text-slate-800">{row.available_quantity}</span>
      <Badge tone={row.is_low_stock ? "warning" : "success"} className="w-fit">
        {row.is_low_stock ? `低库存 <= ${row.warning_threshold}` : "正常"}
      </Badge>
    </TableRow>
  );
}

/** 渲染 InventoryMovementRow 组件，集中展示库存流水行所需的数据、状态和操作入口。 */
function InventoryMovementRow({ movement }: { movement: StoreInventoryMovementRow }) {
  return (
    <TableRow columns={MOVEMENT_COLUMNS}>
      <span className="font-medium text-slate-900">{movementTypeLabel(movement.movement_type)}</span>
      <Link href={`/products/${movement.product_id}?tab=overview`} className="text-info hover:text-sky-900">
        {movement.product_name}
      </Link>
      <span className="text-body">{movement.sku_code}</span>
      <span className="font-medium text-slate-800">{formatSigned(movement.quantity_delta)}</span>
      <span className="text-body">{formatSigned(movement.locked_delta)}</span>
      <span className="truncate text-body">{movement.reason ?? movement.created_at}</span>
    </TableRow>
  );
}

/** 把流水type状态映射为中文显示文本，保持页面口径一致。 */
function movementTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    inbound: "入库",
    outbound: "出库",
    adjustment: "盘点",
    lock: "锁定",
    release: "释放",
  };
  return labels[type] ?? type;
}

/** 格式化带符号，统一空值、本地化和页面展示规则，避免各组件重复格式化。 */
function formatSigned(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}
