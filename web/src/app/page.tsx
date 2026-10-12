import {
  ArrowRight,
  Boxes,
  Building2,
  ClipboardList,
  Database,
  Download,
  FileText,
  ImageIcon,
  Megaphone,
  Package,
  Store as StoreIcon,
} from "lucide-react";
import Link from "next/link";

import { ProductCreateForm } from "@/components/product-create-form";
import { StoreCreateForm } from "@/components/store-create-form";
import {
  Badge,
  type BadgeTone,
  Button,
  buttonClass,
  Card,
  EmptyState,
  FormAlert,
  LinkButton,
  PageHeader,
  StatCard,
  StatCardGrid,
  TableEmpty,
  TableHead,
  TableRow,
} from "@/components/ui";
import { getCurrentUser, getProducts, getStores } from "@/lib/api";
import { getAuthToken } from "@/lib/session";
import type { Platform, Product, Store } from "@/types";

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

const platformFilters: Array<{ value: "all" | Platform; label: string }> = [
  { value: "all", label: "全部平台" },
  { value: "douyin", label: "抖音" },
  { value: "taobao", label: "淘宝" },
  { value: "tmall", label: "天猫" },
  { value: "pinduoduo", label: "拼多多" },
  { value: "jd", label: "京东" },
];

const workflow = [
  { title: "建店建档", icon: Building2, href: "/" },
  { title: "导入数据", icon: ClipboardList, href: "/imports" },
  { title: "补商品信息", icon: ImageIcon, href: "/?workflow=product" },
  { title: "投放建议", icon: Megaphone, href: "/?workflow=ads" },
  { title: "周期复盘", icon: FileText, href: "/?workflow=review" },
];

/** 商品池表格列宽：商品 / 店铺 / 平台 / 售价 / 卖点 / 动作。 */
const productColumns = "1.3fr 0.9fr 0.8fr 0.7fr 1fr 96px";

type HomeProps = {
  searchParams?: Promise<{ platform?: string; store?: string; demo?: string }>;
};

/** 渲染首页页面；在服务端加载业务数据，并把交互交给对应表单或客户端组件。 */
export default async function Home({ searchParams }: HomeProps) {
  const query = searchParams ? await searchParams : {};
  const selectedPlatform = parsePlatform(query.platform);
  const selectedStoreId = parseStoreId(query.store);
  // 首页聚合商品、店铺和当前用户权限；写操作入口只在 canEdit 为 true 时展示。
  const [products, stores, token] = await Promise.all([getProducts(), getStores(), getAuthToken()]);
  const currentUser = token ? await getCurrentUser(token) : null;
  const canEdit = Boolean(currentUser?.permissions.can_edit);

  const storeById = new Map(stores.map((store) => [store.id, store]));
  const productsByStore = countProductsByStore(products);
  const activeStores = stores.filter((store) => store.status === "active").length;
  const platformCount = new Set([...stores.map((store) => store.platform), ...products.map((product) => product.platform)]).size;
  const unboundProducts = products.filter((product) => product.store_id === null).length;
  const workflowItems = buildHomeWorkflow(products, stores, unboundProducts);
  const filteredProducts = products.filter((product) => {
    if (selectedPlatform !== "all" && product.platform !== selectedPlatform) {
      return false;
    }
    if (selectedStoreId !== null && product.store_id !== selectedStoreId) {
      return false;
    }
    return true;
  });

  const platformFilterLabel = selectedPlatform === "all" ? "全部平台" : platformLabels[selectedPlatform];
  const storeFilterLabel =
    selectedStoreId === null ? "全部店铺" : storeById.get(selectedStoreId)?.name ?? "未知店铺";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="工作台"
        description={`当前筛选：${platformFilterLabel} · ${storeFilterLabel} · 命中 ${filteredProducts.length} / ${products.length} 个商品`}
        actions={
          <>
            {canEdit ? (
              <form action="/workspace/demo-data" method="post">
                <Button type="submit">
                  <Database className="h-4 w-4" aria-hidden="true" />
                  生成演示数据
                </Button>
              </form>
            ) : null}
            <LinkButton href="/workspace/templates/performance-records" variant="default">
              <Download className="h-4 w-4" aria-hidden="true" />
              下载导入模板
            </LinkButton>
            {canEdit ? (
              <LinkButton href="/imports" variant="default">
                <Package className="h-4 w-4" aria-hidden="true" />
                导入中心
              </LinkButton>
            ) : null}
          </>
        }
      />

      <StatCardGrid>
        <StatCard
          label="商品总数"
          value={products.length}
          unit="个"
          hint={`命中 ${filteredProducts.length} 个`}
        />
        <StatCard
          label="活跃店铺"
          value={activeStores}
          unit="家"
          hint={`共 ${stores.length} 家店铺`}
        />
        <StatCard label="覆盖平台" value={platformCount} unit="个" hint="按店铺与商品去重" />
        <StatCard
          label="未绑定店铺商品"
          value={unboundProducts}
          unit="个"
          tone={unboundProducts > 0 ? "warning" : "default"}
          hint={unboundProducts > 0 ? "需要补店铺归属" : "全部已绑定店铺"}
        />
      </StatCardGrid>

      <Card
        title="演示和导入"
        description="用演示数据快速跑通店铺、库存、投放实验和复盘链路，或下载绩效数据导入模板。"
      >
        <div className="flex flex-col gap-3">
          {query.demo === "created" ? <FormAlert tone="success">演示数据已准备好。</FormAlert> : null}
          {query.demo === "failed" ? (
            <FormAlert tone="error">演示数据创建失败，请确认当前账号有编辑权限。</FormAlert>
          ) : null}
          {!canEdit ? (
            <FormAlert tone="warning">
              当前账号为只读权限，只能查看数据，不能创建或导入。
            </FormAlert>
          ) : null}
        </div>
      </Card>

      <div className={["grid gap-6", canEdit ? "xl:grid-cols-[360px_1fr]" : ""].join(" ")}>
        {canEdit ? (
          <div className="flex flex-col gap-6">
            <Card>
              <StoreCreateForm />
            </Card>
            <Card>
              <ProductCreateForm stores={stores} />
            </Card>
          </div>
        ) : null}

        <div className="flex flex-col gap-6">
          <Card
            title="店铺视图"
            description="按平台和店铺归拢商品，先把多平台运营入口铺出来"
            actions={
              <div className="flex flex-wrap gap-2">
                {platformFilters.map((platform) => (
                  <Link
                    key={platform.value}
                    href={platform.value === "all" ? "/" : `/?platform=${platform.value}`}
                    className={buttonClass({
                      variant: selectedPlatform === platform.value ? "primary" : "default",
                      size: "sm",
                    })}
                  >
                    {platform.label}
                  </Link>
                ))}
              </div>
            }
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {stores.length === 0 ? (
                <EmptyState title="还没有店铺，先在左侧创建一个平台店铺。" />
              ) : (
                stores.map((store) => (
                  <StoreSummaryCard
                    key={store.id}
                    store={store}
                    productCount={productsByStore.get(store.id) ?? 0}
                    selected={store.id === selectedStoreId}
                  />
                ))
              )}
              {unboundProducts > 0 ? (
                <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-warning" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-strong">未绑定店铺商品</p>
                      <p className="mt-1 text-xs text-warning">
                        {unboundProducts} 个商品需要补店铺归属
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card
            title="商品池"
            description="围绕每个商品补竞品、出素材、做投放实验和复盘"
            actions={
              <Badge tone="neutral" className="gap-1.5">
                <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
                {filteredProducts.length} / {products.length}
              </Badge>
            }
            padded={false}
          >
            <TableHead columns={productColumns}>
              <span>商品</span>
              <span>店铺</span>
              <span>平台</span>
              <span>售价</span>
              <span>卖点</span>
              <span>动作</span>
            </TableHead>

            {filteredProducts.length === 0 ? (
              <TableEmpty columns={productColumns}>
                <EmptyState compact title="当前筛选下没有商品，可以新建商品或切换平台。" />
              </TableEmpty>
            ) : (
              filteredProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  store={product.store_id ? storeById.get(product.store_id) : null}
                />
              ))
            )}
          </Card>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-5">
        {workflow.map((item) => {
          const Icon = item.icon;
          const workflowItem = workflowItems.get(item.title);
          return (
            <Link
              key={item.title}
              href={workflowItem?.href ?? item.href}
              className="rounded-lg border border-hairline bg-surface p-4 shadow-card transition-colors hover:border-brand/30 hover:bg-brand-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <Badge tone="neutral">{workflowItem?.count ?? 0}</Badge>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-strong">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-body">{workflowItem?.hint ?? "查看下一步"}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

/** 构建首页工作流，从现有业务数据推导稳定的页面展示模型，不在渲染阶段修改源数据。 */
function buildHomeWorkflow(products: Product[], stores: Store[], unboundProducts: number): Map<string, { count: number; hint: string; href: string }> {
  // 工作流卡片只用已有数据提示下一步，不自动创建诊断、素材或投放实验。
  const missingSellingPoints = products.filter((product) => product.selling_points.length === 0).length;
  const missingPlatformIds = products.filter((product) => !product.external_product_id).length;
  const productsReadyForOps = products.filter((product) => product.store_id !== null && product.selling_points.length > 0).length;

  return new Map([
    [
      "建店建档",
      {
        count: stores.length + products.length,
        hint: unboundProducts > 0 ? `${unboundProducts} 个商品待绑定店铺` : "店铺和商品入口",
        href: "/",
      },
    ],
    [
      "导入数据",
      {
        count: missingPlatformIds,
        hint: missingPlatformIds > 0 ? `${missingPlatformIds} 个商品待补平台 ID` : "导入商品/SKU/经营数据",
        href: "/imports",
      },
    ],
    [
      "补商品信息",
      {
        count: missingSellingPoints,
        hint: missingSellingPoints > 0 ? `${missingSellingPoints} 个商品待补卖点` : "进入单品运营闭环",
        href: firstProductHref(products, "overview"),
      },
    ],
    [
      "投放建议",
      {
        count: productsReadyForOps,
        hint: productsReadyForOps > 0 ? "从素材和链接生成投放建议" : "先补商品基础信息",
        href: firstProductHref(products, "ads"),
      },
    ],
    [
      "周期复盘",
      {
        count: products.length,
        hint: products.length > 0 ? "回填经营数据后生成复盘" : "先创建商品",
        href: firstProductHref(products, "review"),
      },
    ],
  ]);
}

/** 首个商品链接，从现有业务数据推导稳定的页面展示模型，不在渲染阶段修改源数据。 */
function firstProductHref(products: Product[], tab: string): string {
  return products[0] ? `/products/${products[0].id}?tab=${tab}` : "/";
}

/** 店铺状态对应的中文文案与徽标色调。 */
function storeStatusMeta(status: Store["status"]): { label: string; tone: BadgeTone } {
  if (status === "active") {
    return { label: "启用", tone: "success" };
  }
  if (status === "paused") {
    return { label: "暂停", tone: "warning" };
  }
  return { label: "关闭", tone: "danger" };
}

/** 渲染 StoreSummaryCard 组件，集中展示店铺汇总卡片所需的数据、状态和操作入口。 */
function StoreSummaryCard({
  store,
  productCount,
  selected,
}: {
  store: Store;
  productCount: number;
  selected: boolean;
}) {
  const status = storeStatusMeta(store.status);

  return (
    <div
      className={[
        "rounded-lg border p-4 transition-colors",
        selected ? "border-brand bg-brand-soft" : "border-hairline bg-surface hover:bg-surface-muted",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-body">
            <StoreIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-strong">{store.name}</p>
            <p className="mt-1 text-xs text-body">{platformLabels[store.platform]}</p>
          </div>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-body">商品数</p>
          <p className="mt-1 font-semibold text-strong">{productCount}</p>
        </div>
        <div>
          <p className="text-xs text-body">负责人</p>
          <p className="mt-1 truncate font-semibold text-strong">{store.owner_name ?? "-"}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          href={`/?store=${store.id}`}
          className={buttonClass({ variant: "default", size: "sm" })}
        >
          筛选商品
        </Link>
        <Link href={`/stores/${store.id}`} className={buttonClass({ variant: "primary", size: "sm" })}>
          店铺详情
        </Link>
      </div>
    </div>
  );
}

/** 渲染 ProductRow 组件，集中展示商品行所需的数据、状态和操作入口。 */
function ProductRow({ product, store }: { product: Product; store: Store | null | undefined }) {
  return (
    <TableRow columns={productColumns}>
      <div className="min-w-0">
        <p className="truncate font-medium text-strong">{product.name}</p>
        <p className="mt-1 text-xs text-body">{product.category ?? "未分类"}</p>
      </div>
      <span className="truncate text-body">{store?.name ?? "未绑定"}</span>
      <span className="text-body">{platformLabels[product.platform]}</span>
      <span className="font-medium text-strong">{product.price ? `¥${product.price}` : "-"}</span>
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

/** 统计商品by店铺，封装当前页面重复使用的转换或展示规则，并统一处理空值边界。 */
function countProductsByStore(products: Product[]): Map<number, number> {
  return products.reduce((counts, product) => {
    if (product.store_id !== null) {
      counts.set(product.store_id, (counts.get(product.store_id) ?? 0) + 1);
    }
    return counts;
  }, new Map<number, number>());
}

/** 解析平台，把不可信表单或 JSON 值转换为页面逻辑可安全使用的类型。 */
function parsePlatform(value: string | undefined): "all" | Platform {
  // URL 筛选参数做白名单校验，避免无效平台值影响服务端渲染结果。
  if (!value || value === "all") {
    return "all";
  }
  return Object.hasOwn(platformLabels, value) ? (value as Platform) : "all";
}

/** 解析店铺ID，把不可信表单或 JSON 值转换为页面逻辑可安全使用的类型。 */
function parseStoreId(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const storeId = Number(value);
  return Number.isInteger(storeId) && storeId > 0 ? storeId : null;
}
