import type { ProductDetail, Store } from "@/types";
import { demoProductDetail } from "./products";
import { demoStores } from "./stores";

export { demoProductDetail, demoProductDetails, demoProducts } from "./products";
export { demoStoreInventoryMovements, demoStoreInventorySummary, demoStores } from "./stores";
export { demoTrendProduct, demoTrendProducts } from "./trends";
export type { TrendCompetitor, TrendProduct, TrendRecord, TrendSnapshot } from "./trends";
export {
  demoAgentApprovals,
  demoAgentCatalog,
  demoAgentMemories,
  demoAgentRuns,
  demoAgentTasks,
  demoWorkspaceProducts,
  demoWorkspaceStores,
  demoWorkspaces,
} from "./agent";
export { demoModelSettings, demoUsers } from "./settings";

/** 演示模式下按 ID 查找商品明细，未命中返回 null。 */
export function findDemoProductById(id: number): ProductDetail | null {
  return demoProductDetail(id);
}

/** 演示模式下按 ID 查找店铺，未命中返回 null。 */
export function findDemoStoreById(id: number): Store | null {
  return demoStores.find((store) => store.id === id) ?? null;
}
