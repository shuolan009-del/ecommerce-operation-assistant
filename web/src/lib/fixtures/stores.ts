import type {
  PlatformAccount,
  Store,
  StoreInventoryMovementRow,
  StoreInventoryRow,
  StoreInventorySummary,
} from "@/types";
import { demoProductDetails } from "./products";

const DEMO_CREATED_AT = "2026-08-16T09:00:00+08:00";
const DEMO_UPDATED_AT = "2026-10-12T18:00:00+08:00";

type PlatformAccountSeed = {
  account_name: string;
  external_account_id: string;
  status: PlatformAccount["status"];
  note: string | null;
};

/** 构造平台账号，ID 由店铺 ID 推导，保证唯一且稳定。 */
function buildPlatformAccounts(
  storeId: number,
  platform: Store["platform"],
  seeds: PlatformAccountSeed[],
): PlatformAccount[] {
  return seeds.map((seed, index) => ({
    id: storeId * 10 + index + 1,
    store_id: storeId,
    platform,
    account_name: seed.account_name,
    external_account_id: seed.external_account_id,
    status: seed.status,
    auth_metadata: { auth_type: "oauth", scope: "shop_read" },
    note: seed.note,
    created_at: DEMO_CREATED_AT,
    updated_at: DEMO_UPDATED_AT,
  }));
}

/** 演示环境店铺数据，覆盖抖音 / 淘宝 / 天猫 / 拼多多与上下线状态。 */
export const demoStores: Store[] = [
  {
    id: 1,
    name: "山野优选生鲜旗舰店",
    platform: "douyin",
    status: "active",
    external_store_id: "DY-STORE-001",
    owner_name: "王秀兰",
    note: "抖音主阵地，直播与短视频同步运营。",
    platform_accounts: buildPlatformAccounts(1, "douyin", [
      {
        account_name: "山野优选官方号",
        external_account_id: "DY-ACC-8801",
        status: "active",
        note: "主账号，直播间挂车使用。",
      },
      {
        account_name: "山野优选·助农号",
        external_account_id: "DY-ACC-8802",
        status: "expired",
        note: "授权已过期，需重新绑定。",
      },
    ]),
    created_at: DEMO_CREATED_AT,
    updated_at: DEMO_UPDATED_AT,
  },
  {
    id: 2,
    name: "沃野农品淘宝店",
    platform: "taobao",
    status: "active",
    external_store_id: "TB-STORE-002",
    owner_name: "李文强",
    note: "以水果与粮油为主，客群偏年轻。",
    platform_accounts: buildPlatformAccounts(2, "taobao", [
      {
        account_name: "沃野农品",
        external_account_id: "TB-ACC-6601",
        status: "active",
        note: null,
      },
    ]),
    created_at: DEMO_CREATED_AT,
    updated_at: DEMO_UPDATED_AT,
  },
  {
    id: 3,
    name: "有机厨房天猫旗舰店",
    platform: "tmall",
    status: "active",
    external_store_id: "TM-STORE-003",
    owner_name: "陈美玲",
    note: "品牌形象店，主打高客单有机食品。",
    platform_accounts: buildPlatformAccounts(3, "tmall", [
      {
        account_name: "有机厨房旗舰店",
        external_account_id: "TM-ACC-3301",
        status: "active",
        note: "旗舰店主账号。",
      },
      {
        account_name: "有机厨房·京东同步号",
        external_account_id: "JD-ACC-3302",
        status: "active",
        note: "用于京东渠道同步，账号信息待核对。",
      },
    ]),
    created_at: DEMO_CREATED_AT,
    updated_at: DEMO_UPDATED_AT,
  },
  {
    id: 4,
    name: "山货直供拼多多店",
    platform: "pinduoduo",
    status: "paused",
    external_store_id: "PDD-STORE-004",
    owner_name: "赵建国",
    note: "因品控问题暂停运营，待整改后恢复。",
    platform_accounts: buildPlatformAccounts(4, "pinduoduo", [
      {
        account_name: "山货直供",
        external_account_id: "PDD-ACC-1101",
        status: "disabled",
        note: "店铺暂停期间账号已停用。",
      },
    ]),
    created_at: DEMO_CREATED_AT,
    updated_at: DEMO_UPDATED_AT,
  },
];

/** 取某店铺下的全部商品与 SKU 组合，供库存汇总与流水复用。 */
function storeSkus(storeId: number) {
  return demoProductDetails
    .filter((product) => product.store_id === storeId)
    .flatMap((product) => product.skus.map((sku) => ({ product, sku })));
}

/** 演示环境店铺库存汇总：按 SKU 展开为明细行，并在行上重新汇总总计。 */
export function demoStoreInventorySummary(storeId: number): StoreInventorySummary {
  const rows: StoreInventoryRow[] = storeSkus(storeId)
    .slice(0, 5)
    .map(({ product, sku }) => {
      const item = sku.inventory_item;
      const quantity = item?.quantity ?? 0;
      const lockedQuantity = item?.locked_quantity ?? 0;
      const availableQuantity = quantity - lockedQuantity;
      const warningThreshold = item?.warning_threshold ?? 0;

      return {
        product_id: product.id,
        product_name: product.name,
        sku_id: sku.id,
        sku_code: sku.sku_code,
        sku_name: sku.name,
        quantity,
        locked_quantity: lockedQuantity,
        available_quantity: availableQuantity,
        warning_threshold: warningThreshold,
        is_low_stock: availableQuantity <= warningThreshold,
        location: item?.location ?? null,
      };
    });

  return {
    store_id: storeId,
    sku_count: rows.length,
    total_quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    total_locked_quantity: rows.reduce((sum, row) => sum + row.locked_quantity, 0),
    total_available_quantity: rows.reduce((sum, row) => sum + row.available_quantity, 0),
    low_stock_count: rows.filter((row) => row.is_low_stock).length,
    rows,
  };
}

/** 演示环境库存流水模板：按固定顺序轮换出入库与调整，保证类型覆盖。 */
const MOVEMENT_PLAN: Array<{
  movement_type: StoreInventoryMovementRow["movement_type"];
  quantity_delta: number;
  locked_delta: number;
  reason: string;
  operator_name: string;
  created_at: string;
}> = [
  {
    movement_type: "inbound",
    quantity_delta: 200,
    locked_delta: 0,
    reason: "采购入库",
    operator_name: "仓储-李伟",
    created_at: "2026-09-26T09:30:00+08:00",
  },
  {
    movement_type: "outbound",
    quantity_delta: -36,
    locked_delta: 0,
    reason: "订单出库",
    operator_name: "仓储-孙倩",
    created_at: "2026-09-28T14:10:00+08:00",
  },
  {
    movement_type: "adjustment",
    quantity_delta: -4,
    locked_delta: 0,
    reason: "月度盘点差异",
    operator_name: "仓储主管-周涛",
    created_at: "2026-09-30T17:40:00+08:00",
  },
  {
    movement_type: "inbound",
    quantity_delta: 150,
    locked_delta: 0,
    reason: "补货入库",
    operator_name: "仓储-李伟",
    created_at: "2026-10-02T08:50:00+08:00",
  },
  {
    movement_type: "outbound",
    quantity_delta: -52,
    locked_delta: 0,
    reason: "直播间集中出库",
    operator_name: "仓储-孙倩",
    created_at: "2026-10-04T20:15:00+08:00",
  },
  {
    movement_type: "adjustment",
    quantity_delta: 6,
    locked_delta: 0,
    reason: "破损返修回库",
    operator_name: "仓储主管-周涛",
    created_at: "2026-10-06T11:05:00+08:00",
  },
  {
    movement_type: "lock",
    quantity_delta: 0,
    locked_delta: 20,
    reason: "预售订单锁库",
    operator_name: "系统自动",
    created_at: "2026-10-08T15:20:00+08:00",
  },
  {
    movement_type: "release",
    quantity_delta: 0,
    locked_delta: -20,
    reason: "预售订单取消释放",
    operator_name: "系统自动",
    created_at: "2026-10-09T10:35:00+08:00",
  },
];

/** 演示环境库存流水：5-8 条，覆盖入库 / 出库 / 调整 / 锁定 / 释放。 */
export function demoStoreInventoryMovements(storeId: number): StoreInventoryMovementRow[] {
  const skus = storeSkus(storeId).slice(0, 4);
  const rows: StoreInventoryMovementRow[] = [];

  MOVEMENT_PLAN.forEach((plan, index) => {
    const target = skus[index % Math.max(skus.length, 1)];
    if (!target) return;
    if (rows.length >= 8) return;

    const item = target.sku.inventory_item;
    const currentQuantity = item?.quantity ?? 0;
    const currentLocked = item?.locked_quantity ?? 0;

    const beforeQuantity =
      plan.movement_type === "inbound" || plan.movement_type === "outbound"
        ? Math.max(0, currentQuantity - plan.quantity_delta)
        : currentQuantity;
    const afterQuantity =
      plan.movement_type === "inbound" || plan.movement_type === "outbound"
        ? beforeQuantity + plan.quantity_delta
        : currentQuantity;

    const beforeLocked =
      plan.movement_type === "lock" || plan.movement_type === "release"
        ? Math.max(0, currentLocked - plan.locked_delta)
        : currentLocked;
    const afterLocked =
      plan.movement_type === "lock" || plan.movement_type === "release"
        ? beforeLocked + plan.locked_delta
        : currentLocked;

    rows.push({
      id: storeId * 1000 + index + 1,
      product_id: target.product.id,
      product_name: target.product.name,
      sku_id: target.sku.id,
      sku_code: target.sku.sku_code,
      sku_name: target.sku.name,
      movement_type: plan.movement_type,
      quantity_delta: plan.quantity_delta,
      locked_delta: plan.locked_delta,
      before_quantity: beforeQuantity,
      after_quantity: afterQuantity,
      before_locked_quantity: beforeLocked,
      after_locked_quantity: afterLocked,
      reason: plan.reason,
      operator_name: plan.operator_name,
      created_at: plan.created_at,
    });
  });

  return rows;
}
