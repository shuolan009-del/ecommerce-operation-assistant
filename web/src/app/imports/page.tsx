import { Download } from "lucide-react";

import { PerformanceImportCenterPanel, ProductImportPanel, SkuInventoryImportPanel } from "@/components/product-import-panel";
import { Card, LinkButton, PageHeader } from "@/components/ui";

const templates = [
  {
    title: "商品档案模板",
    description: "用于导入店铺商品、平台、价格、受众、卖点和平台商品 ID。",
    href: "/workspace/templates/products",
  },
  {
    title: "SKU 库存模板",
    description: "用于导入 SKU 编码、规格、初始库存、预警线、仓位和平台 SKU ID。",
    href: "/workspace/templates/sku-inventory",
  },
  {
    title: "经营数据模板",
    description: "用于导入曝光、点击、成交、花费、成交额等投放复盘数据。",
    href: "/workspace/templates/performance-records",
  },
  {
    title: "字段映射模板",
    description: "用于把淘宝、天猫、拼多多、京东、抖音等平台字段映射到系统字段。",
    href: "/workspace/templates/field-mapping",
  },
];

/** 渲染导入页面；在服务端加载业务数据，并把交互交给对应表单或客户端组件。 */
export default function ImportCenterPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="数据导入"
        crumbs={[{ label: "工作台", href: "/" }, { label: "数据导入" }]}
        description="汇总商品、SKU 库存、经营数据和平台字段映射模板，后续承接导入预览和错误行提示。"
        actions={
          <LinkButton href="/" variant="default">
            返回工作台
          </LinkButton>
        }
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <Card
            key={template.href}
            title={template.title}
            description={template.description}
            actions={
              <LinkButton
                href={template.href}
                variant="default"
                size="sm"
                className="shrink-0"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                下载
              </LinkButton>
            }
            padded={false}
          >
            {null}
          </Card>
        ))}
      </section>

      <ProductImportPanel />
      <SkuInventoryImportPanel />
      <PerformanceImportCenterPanel />

      <Card title="已接入能力">
        <div className="grid gap-3 md:grid-cols-3">
          <StatusCard title="经营数据 CSV" status="已支持预览" />
          <StatusCard title="字段映射模板" status="已提供" />
          <StatusCard title="商品/SKU 导入预览" status="已接入" />
        </div>
      </Card>
    </div>
  );
}

/** 渲染 StatusCard 组件，集中展示状态卡片所需的数据、状态和操作入口。 */
function StatusCard({ title, status }: { title: string; status: string }) {
  return (
    <div className="rounded-md border border-hairline bg-surface-muted p-4">
      <p className="text-sm font-semibold text-strong">{title}</p>
      <p className="mt-2 text-sm text-body">{status}</p>
    </div>
  );
}
