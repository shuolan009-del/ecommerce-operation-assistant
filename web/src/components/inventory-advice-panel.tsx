"use client";

import { Brain, Loader2 } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, FormAlert } from "@/components/ui";
import type { StoreInventoryAdvice } from "@/types";

/** 渲染 InventoryAdvicePanel 组件，集中展示库存建议面板所需的数据、状态和操作入口。 */
export function InventoryAdvicePanel({ storeId, canEdit = true }: { storeId: number; canEdit?: boolean }) {
  const [advice, setAdvice] = useState<StoreInventoryAdvice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** 处理生成建议交互，维护必要状态并把副作用交给受控路由或后端 API。 */
  async function generateAdvice() {
    setLoading(true);
    setError(null);
    try {
      // 库存建议是按需生成的运营参考，不在前端直接触发补货、锁库或投放暂停等动作。
      const response = await fetch(`/stores/${storeId}/inventory-advice/generate`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("生成失败");
      }
      setAdvice((await response.json()) as StoreInventoryAdvice);
    } catch {
      setError("库存建议生成失败，请确认已登录且账号有编辑权限。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      title="库存异常 AI 建议"
      description="结合低库存、锁定库存和投放节奏生成处理建议"
      actions={
        canEdit ? (
          <Button variant="brand" onClick={generateAdvice} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Brain className="h-4 w-4" aria-hidden="true" />
            )}
            生成建议
          </Button>
        ) : (
          <Badge tone="warning">只读模式</Badge>
        )
      }
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      {advice ? (
        <div className="mt-4 grid gap-4">
          <div className="rounded-md border border-hairline bg-brand-soft p-4">
            <p className="text-xs font-medium text-brand">{advice.source === "llm" ? "AI 生成" : "规则建议"}</p>
            <p className="mt-2 text-sm leading-6 text-body">{advice.summary}</p>
          </div>
          <AdviceList title="风险判断" items={advice.risks} />
          <AdviceList title="补货动作" items={advice.replenishment_actions} />
          <AdviceList title="运营动作" items={advice.operation_actions} />
          <AdviceList title="投放控制" items={advice.ad_controls} />
        </div>
      ) : null}
    </Card>
  );
}

/** 渲染 AdviceList 组件，集中展示建议列表所需的数据、状态和操作入口。 */
function AdviceList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-hairline bg-surface-muted p-4">
      <h3 className="text-sm font-semibold text-strong">{title}</h3>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6 text-body">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
