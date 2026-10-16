import { LinkIcon, Plus } from "lucide-react";

import type { Platform, PlatformProductMapping, ProductSku, Store } from "@/types";

import { Badge, Button, EmptyState, Field, FormAlert, Input, Select, TableShell } from "@/components/ui";

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

const platforms: Array<{ label: string; value: Platform }> = [
  { label: "抖音", value: "douyin" },
  { label: "淘宝", value: "taobao" },
  { label: "天猫", value: "tmall" },
  { label: "拼多多", value: "pinduoduo" },
  { label: "京东", value: "jd" },
  { label: "TikTok", value: "tiktok_shop" },
  { label: "Amazon", value: "amazon" },
  { label: "其他", value: "other" },
];

/** 渲染 PlatformMappingPanel 组件，集中展示平台mapping面板所需的数据、状态和操作入口。 */
export function PlatformMappingPanel({
  productId,
  productPlatform,
  productStoreId,
  stores,
  skus,
  mappings,
  mappingStatus,
  canEdit = true,
}: {
  productId: number;
  productPlatform: Platform;
  productStoreId: number | null;
  stores: Store[];
  skus: ProductSku[];
  mappings: PlatformProductMapping[];
  mappingStatus?: string;
  canEdit?: boolean;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-6">
      {/* 平台映射把内部商品/SKU 和平台商品 ID 分开维护，为多平台库存和经营数据对账预留入口。 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-strong">平台映射</h2>
          <p className="mt-1 text-sm text-body">维护平台商品 ID、平台 SKU ID 和商品链接</p>
        </div>
        <Badge tone="neutral">{mappings.length} 条映射</Badge>
      </div>

      {mappingStatus === "created" ? (
        <FormAlert tone="success" className="mt-3">
          平台映射已创建。
        </FormAlert>
      ) : null}
      {mappingStatus === "failed" ? (
        <FormAlert tone="error" className="mt-3">
          平台映射创建失败，请检查店铺、SKU 和链接格式。
        </FormAlert>
      ) : null}

      {canEdit ? (
        <form action={`/products/${productId}/platform-mappings/create`} method="post" className="mt-5 grid gap-3">
        {/* 这里仅保存平台侧标识和链接，不接收平台账号密码或授权 token。 */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Field label="平台">
            <Select name="platform" defaultValue={productPlatform}>
              {platforms.map((platform) => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="店铺">
            <Select name="store_id" defaultValue={productStoreId ?? ""}>
              <option value="">不绑定店铺</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="SKU">
            <Select name="sku_id">
              <option value="">商品级映射</option>
              {skus.map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {sku.sku_code} · {sku.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Field label="平台商品 ID">
            <Input name="external_product_id" required placeholder="item_id" />
          </Field>
          <Field label="平台 SKU ID">
            <Input name="external_sku_id" placeholder="sku_id" />
          </Field>
          <Field label="平台状态">
            <Input name="status" placeholder="online / offline" />
          </Field>
        </div>

        <Field label="商品链接">
          <Input name="listing_url" type="url" placeholder="https://..." />
        </Field>

        <Button type="submit" variant="primary">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          添加映射
        </Button>
        </form>
      ) : null}

      <TableShell className="mt-5">
        <div className="hidden border-b border-hairline bg-surface-muted px-4 py-2.5 text-xs font-semibold text-muted lg:grid lg:grid-cols-[0.7fr_1fr_1fr_0.8fr_0.8fr]">
          <span>平台</span>
          <span>平台商品 ID</span>
          <span>平台 SKU ID</span>
          <span>状态</span>
          <span>链接</span>
        </div>
        {mappings.length === 0 ? (
          <EmptyState compact title="还没有平台映射。" />
        ) : (
          <div className="divide-y divide-hairline">
            {mappings.map((mapping) => (
              <div
                key={mapping.id}
                className="grid gap-2 px-4 py-3 text-sm transition-colors hover:bg-surface-muted lg:grid-cols-[0.7fr_1fr_1fr_0.8fr_0.8fr] lg:items-center"
              >
                <span className="text-body">{platformLabels[mapping.platform]}</span>
                <span className="font-medium text-strong">{mapping.external_product_id}</span>
                <span className="text-body">{mapping.external_sku_id ?? "-"}</span>
                <span className="text-body">{mapping.status ?? "-"}</span>
                {mapping.listing_url ? (
                  <a
                    href={mapping.listing_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-info hover:text-brand"
                  >
                    <LinkIcon className="h-3 w-3" aria-hidden="true" />
                    打开
                  </a>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </div>
            ))}
          </div>
        )}
      </TableShell>
    </div>
  );
}
