import Link from "next/link";

import { buttonClass, Card } from "@/components/ui";

export default function CourseStagePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-5 py-10">
      <div className="w-full max-w-3xl">
        <Card title="当前学习阶段：基础业务系统">
          <div className="flex flex-col gap-4 text-sm leading-6 text-body">
            <p>
              模型配置、自动诊断、创意生成、图片视频生成及 Agent 能力将在 04、05 篇接入。当前可使用商品、库存、竞品、导入、经营数据和人工方案管理。
            </p>
            <p>
              用户管理通过后端 Swagger 的 users 接口完成。示范资料请按笔记手工创建，本阶段不导入带有模拟生成结果的演示数据。
            </p>
          </div>
          <div className="mt-5">
            <Link href="/" className={buttonClass({ variant: "default" })}>
              返回工作台
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
