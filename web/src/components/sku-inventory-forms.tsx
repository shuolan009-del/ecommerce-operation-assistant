import { Boxes, Plus } from "lucide-react";

import type { ProductSku } from "@/types";

import { Badge, Button, EmptyState, Field, FormAlert, Input, Select, TableShell } from "@/components/ui";

/** 渲染 SkuCreateForm 组件，集中展示SKU创建表单所需的数据、状态和操作入口。 */
export function SkuCreateForm({ canEdit = true, productId }: { canEdit?: boolean; productId: number }) {
  if (!canEdit) {
    // SKU 创建会同步初始化库存档案，只读账号不展示入口，避免误导用户以为可写。
    return (
      <div>
        <h2 className="text-lg font-semibold text-strong">新建 SKU</h2>
        <FormAlert tone="warning" className="mt-2">
          当前账号为只读权限，不能新建 SKU。
        </FormAlert>
      </div>
    );
  }

  return (
    <form action={`/products/${productId}/skus/create`} method="post" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-white">
          <Boxes className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-strong">新建 SKU</h2>
          <p className="text-sm text-body">补齐规格、库存和预警线</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU 编码">
          <Input name="sku_code" required placeholder="例如：SKU-001" />
        </Field>
        <Field label="规格名称">
          <Input name="name" required placeholder="例如：12 包装" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="售价">
          <Input name="price" inputMode="decimal" placeholder="29.90" />
        </Field>
        <Field label="成本">
          <Input name="cost" inputMode="decimal" placeholder="12.50" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="初始库存">
          <Input name="initial_quantity" inputMode="numeric" placeholder="100" />
        </Field>
        <Field label="预警线">
          <Input name="warning_threshold" inputMode="numeric" placeholder="20" />
        </Field>
        <Field label="仓位">
          <Input name="location" placeholder="A-01" />
        </Field>
      </div>

      <Button type="submit" variant="primary" className="w-full">
        <Plus className="h-4 w-4" aria-hidden="true" />
        创建 SKU
      </Button>
    </form>
  );
}

/** 渲染 InventoryMovementForm 组件，集中展示库存流水表单所需的数据、状态和操作入口。 */
export function InventoryMovementForm({ productId, sku }: { productId: number; sku: ProductSku }) {
  return (
    <form
      action={`/products/${productId}/skus/${sku.id}/inventory-movements/create`}
      method="post"
      className="grid gap-3 border-t border-hairline-subtle pt-3 sm:grid-cols-[120px_90px_1fr_96px]"
    >
      {/* 表单只收“动作类型 + 数量”，正负 delta 的转换放在服务端 route，保证库存口径统一。 */}
      <label className="block">
        <span className="sr-only">类型</span>
        <Select name="movement_type" defaultValue="inbound">
          <option value="inbound">入库</option>
          <option value="outbound">出库</option>
          <option value="lock">锁定</option>
          <option value="release">释放</option>
        </Select>
      </label>
      <label className="block">
        <span className="sr-only">数量</span>
        <Input name="quantity" required inputMode="numeric" placeholder="数量" />
      </label>
      <label className="block">
        <span className="sr-only">原因</span>
        <Input name="reason" placeholder="原因" />
      </label>
      <Button type="submit" variant="primary">
        登记
      </Button>
    </form>
  );
}

/** 渲染 SkuInventoryPanel 组件，集中展示SKU库存面板所需的数据、状态和操作入口。 */
export function SkuInventoryPanel({
  productId,
  skus,
  skuStatus,
  inventoryStatus,
  canEdit = true,
}: {
  productId: number;
  skus: ProductSku[];
  skuStatus?: string;
  inventoryStatus?: string;
  canEdit?: boolean;
}) {
  const safeSkus = skus ?? [];

  return (
    <div className="rounded-lg border border-hairline bg-surface p-6">
      {/* 库存面板同时展示当前快照和最近流水，帮助运营判断低库存、锁定占用和盘点差异。 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-strong">SKU 与库存</h2>
          <p className="mt-1 text-sm text-body">库存变化通过流水登记，便于后续对账和追踪</p>
        </div>
        <Badge tone="neutral">{safeSkus.length} 个 SKU</Badge>
      </div>

      {skuStatus === "created" ? (
        <FormAlert tone="success" className="mt-3">
          SKU 已创建。
        </FormAlert>
      ) : null}
      {skuStatus === "updated" ? (
        <FormAlert tone="success" className="mt-3">
          SKU 已更新。
        </FormAlert>
      ) : null}
      {skuStatus === "failed" || inventoryStatus === "failed" ? (
        <FormAlert tone="error" className="mt-3">
          库存操作失败，请检查数量和权限。
        </FormAlert>
      ) : null}
      {inventoryStatus === "updated" ? (
        <FormAlert tone="success" className="mt-3">
          库存流水已登记。
        </FormAlert>
      ) : null}
      {inventoryStatus === "stocktaken" ? (
        <FormAlert tone="success" className="mt-3">
          库存盘点已登记。
        </FormAlert>
      ) : null}

      <TableShell className="mt-5">
        <div className="hidden border-b border-hairline bg-surface-muted px-4 py-2.5 text-xs font-semibold text-muted lg:grid lg:grid-cols-[1.1fr_0.8fr_0.7fr_0.7fr_0.7fr]">
          <span>SKU</span>
          <span>价格</span>
          <span>现货</span>
          <span>锁定</span>
          <span>预警</span>
        </div>
        {safeSkus.length === 0 ? (
          <EmptyState compact title="还没有 SKU，先在左侧创建一个规格。" />
        ) : (
          <div className="divide-y divide-hairline">
            {safeSkus.map((sku) => (
              <div key={sku.id} className="px-4 py-4 transition-colors hover:bg-surface-muted">
                <div className="grid gap-3 text-sm lg:grid-cols-[1.1fr_0.8fr_0.7fr_0.7fr_0.7fr] lg:items-center">
                  <div>
                    <p className="font-medium text-strong">{sku.name}</p>
                    <p className="mt-1 text-xs text-body">{sku.sku_code}</p>
                  </div>
                  <span className="text-body">{sku.price ? `¥${sku.price}` : "-"}</span>
                  <span className="font-medium text-strong">{sku.inventory_item?.quantity ?? 0}</span>
                  <span className="text-body">{sku.inventory_item?.locked_quantity ?? 0}</span>
                  <span className="text-body">{sku.inventory_item?.warning_threshold ?? 0}</span>
                </div>
                {canEdit ? (
                  <>
                    <InventoryMovementForm productId={productId} sku={sku} />
                    <details className="mt-3 rounded-lg border border-hairline bg-surface px-3 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-body">编辑 SKU / 盘点</summary>
                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        <SkuUpdateForm productId={productId} sku={sku} />
                        <StocktakeForm productId={productId} sku={sku} />
                      </div>
                    </details>
                  </>
                ) : null}
                <div className="mt-3 grid gap-2">
                  {(sku.inventory_movements ?? []).slice(0, 3).map((movement) => (
                    <div
                      key={movement.id}
                      className="grid gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs text-body sm:grid-cols-[90px_90px_90px_1fr]"
                    >
                      <span className="font-medium text-strong">{movementTypeLabel(movement.movement_type)}</span>
                      <span>现货 {formatSigned(movement.quantity_delta)}</span>
                      <span>锁定 {formatSigned(movement.locked_delta)}</span>
                      <span className="truncate">{movement.reason ?? movement.created_at}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </TableShell>
    </div>
  );
}

/** 渲染 SkuUpdateForm 组件，集中展示SKU更新表单所需的数据、状态和操作入口。 */
function SkuUpdateForm({ productId, sku }: { productId: number; sku: ProductSku }) {
  return (
    <form action={`/products/${productId}/skus/${sku.id}/update`} method="post" className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="SKU 编码">
          <Input name="sku_code" required defaultValue={sku.sku_code} />
        </Field>
        <Field label="规格名称">
          <Input name="name" required defaultValue={sku.name} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="售价">
          <Input name="price" inputMode="decimal" defaultValue={sku.price ?? ""} />
        </Field>
        <Field label="成本">
          <Input name="cost" inputMode="decimal" defaultValue={sku.cost ?? ""} />
        </Field>
        <Field label="状态">
          <Select name="status" defaultValue={sku.status}>
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="预警线">
          <Input name="warning_threshold" inputMode="numeric" defaultValue={sku.inventory_item?.warning_threshold ?? 0} />
        </Field>
        <Field label="仓位">
          <Input name="location" defaultValue={sku.inventory_item?.location ?? ""} />
        </Field>
      </div>
      <Button type="submit" variant="primary">
        保存 SKU
      </Button>
    </form>
  );
}

/** 渲染 StocktakeForm 组件，集中展示盘点表单所需的数据、状态和操作入口。 */
function StocktakeForm({ productId, sku }: { productId: number; sku: ProductSku }) {
  const currentQuantity = sku.inventory_item?.quantity ?? 0;

  return (
    <form action={`/products/${productId}/skus/${sku.id}/inventory-movements/stocktake`} method="post" className="grid gap-3">
      {/* 盘点提交目标库存，服务端根据当前库存计算 adjustment delta，保留盘点流水。 */}
      <input type="hidden" name="current_quantity" value={currentQuantity} />
      <Field label="盘点后现货">
        <Input name="target_quantity" required inputMode="numeric" defaultValue={currentQuantity} />
      </Field>
      <Field label="盘点说明">
        <Input name="reason" placeholder="例如：月末盘点" />
      </Field>
      <Button type="submit" variant="default">
        登记盘点
      </Button>
    </form>
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
