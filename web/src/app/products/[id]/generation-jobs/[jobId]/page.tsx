import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormAlert,
  LinkButton,
  PageHeader,
  StatCard,
  StatCardGrid,
  buttonClass,
} from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { getProduct } from "@/lib/api";
import type { GenerationJob } from "@/types";

type GenerationJobDetailPageProps = {
  params: Promise<{ id: string; jobId: string }>;
};

/** 渲染商品/生成任务jobs页面；在服务端加载业务数据，并把交互交给对应表单或客户端组件。 */
export default async function GenerationJobDetailPage({ params }: GenerationJobDetailPageProps) {
  const { id, jobId } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const job = product.generation_jobs.find((item) => item.id === Number(jobId));
  if (!job) {
    notFound();
  }

  const creativePlan = product.creative_plans.find((plan) => plan.id === job.creative_plan_id);
  const resultUrl = jobResultUrl(job);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`生成任务 #${job.id}`}
        description={product.name}
        crumbs={[
          { label: "工作台", href: "/" },
          { label: product.name, href: `/products/${product.id}?tab=jobs` },
          { label: `生成任务 #${job.id}` },
        ]}
        actions={
          <>
            <Link
              href={`/products/${product.id}?tab=jobs`}
              className={buttonClass({ variant: "default" })}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回任务中心
            </Link>
            <JobStatusBadge job={job} />
          </>
        }
      />

      <StatCardGrid>
        <StatCard label="任务类型" value={job.kind === "video_asset" ? "视频生成" : "图片生成"} />
        <StatCard label="关联方案" value={creativePlan?.title ?? "未知方案"} />
        <StatCard label="开始时间" value={job.started_at ?? "未开始"} />
        <StatCard label="完成时间" value={job.finished_at ?? "未完成"} />
      </StatCardGrid>

      {job.error ? (
        <Card title={job.status === "cancelled" ? "取消原因" : "失败原因"}>
          <div className="flex flex-col gap-4">
            <FormAlert tone={job.status === "cancelled" ? "info" : "error"}>
              <p className="whitespace-pre-wrap leading-6">{job.error}</p>
            </FormAlert>
            {job.status === "failed" ? (
              // 只有失败任务暴露重试入口；取消任务代表人工停止，不应该被误操作重新排队。
              <form action={`/products/${product.id}/generation-jobs/${job.id}/retry`} method="post" className="w-fit">
                <input type="hidden" name="tab" value="jobs" />
                <Button type="submit" size="sm">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  重试任务
                </Button>
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}

      {job.status === "pending" || job.status === "running" ? (
        <Card title="任务控制">
          <p className="text-sm leading-6 text-body">取消后任务会停止排队或释放运行锁，不会继续生成素材。</p>
          <form action={`/products/${product.id}/generation-jobs/${job.id}/cancel`} method="post" className="mt-4 w-fit">
            <input type="hidden" name="tab" value="jobs" />
            <Button type="submit" variant="default" size="sm">
              取消任务
            </Button>
          </form>
        </Card>
      ) : null}

      {resultUrl ? (
        <Card title="生成结果">
          <div className="flex items-center justify-between gap-4">
            <p className="break-all text-xs text-body">{resultUrl}</p>
            <LinkButton
              href={absoluteMediaUrl(resultUrl)}
              target="_blank"
              rel="noreferrer"
              variant="default"
              size="sm"
              className="shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              打开结果
            </LinkButton>
          </div>
          {job.kind === "video_asset" ? (
            <video
              src={absoluteMediaUrl(resultUrl)}
              controls
              className="mt-4 aspect-video w-full rounded-md bg-black object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={absoluteMediaUrl(resultUrl)}
              alt="生成结果"
              className="mt-4 max-h-[560px] w-full rounded-md object-contain"
            />
          )}
        </Card>
      ) : null}

      <JobEventTimeline job={job} />

      <div className="grid gap-6 lg:grid-cols-2">
        <JsonPanel title="任务结果 JSON" value={job.result} />
        <JsonPanel title="关联方案 JSON" value={creativePlan?.content ?? {}} />
      </div>
  </div>
  );
}

/** 渲染 JobEventTimeline 组件，集中展示任务事件时间线所需的数据、状态和操作入口。 */
function JobEventTimeline({ job }: { job: GenerationJob }) {
  return (
    <Card
      title="任务事件"
      description="记录入队、开始、失败、重试和完成等生命周期节点"
      actions={<Badge tone="neutral">{job.events.length} 条</Badge>}
    >
      {job.events.length > 0 ? (
        <div className="grid gap-2">
          {job.events.map((event) => (
            <div key={event.id} className="rounded-lg border border-hairline bg-surface-muted px-3 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-strong">{generationJobEventLabel(event.event_type)}</p>
                  <p className="mt-1 text-xs text-body">{event.created_at}</p>
                </div>
                <Badge tone="neutral" className="w-fit">
                  {event.status ? generationJobStatusLabel(event.status) : "无状态"}
                </Badge>
              </div>
              {event.message ? <p className="mt-2 text-sm leading-6 text-body">{event.message}</p> : null}
              {event.worker_id ? <p className="mt-1 text-xs text-muted">worker: {event.worker_id}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="暂无任务事件。新任务会在入队、执行和重试时写入事件。" />
      )}
    </Card>
  );
}

/** 把生成任务任务事件状态映射为中文显示文本，保持页面口径一致。 */
function generationJobEventLabel(type: string): string {
  const labels: Record<string, string> = {
    failed: "执行失败",
    queued: "任务入队",
    retry_requested: "请求重试",
    retry_scheduled: "安排重试",
    started: "开始执行",
    succeeded: "执行成功",
    cancelled: "任务取消",
    timeout_checked: "超时检查",
  };
  return labels[type] ?? type;
}

/** 把生成任务任务状态状态映射为中文显示文本，保持页面口径一致。 */
function generationJobStatusLabel(status: GenerationJob["status"]): string {
  const labels: Record<GenerationJob["status"], string> = {
    failed: "失败",
    pending: "排队中",
    running: "生成中",
    succeeded: "已完成",
    cancelled: "已取消",
  };
  return labels[status];
}

/** 渲染 JsonPanel 组件，集中展示json面板所需的数据、状态和操作入口。 */
function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <Card title={title}>
      <pre className="max-h-[420px] overflow-auto rounded-md bg-accent p-3 text-xs leading-5 text-slate-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </Card>
  );
}

/** 渲染 JobStatusBadge 组件，集中展示任务状态状态徽标所需的数据、状态和操作入口。 */
function JobStatusBadge({ job }: { job: GenerationJob }) {
  const statusLabels: Record<GenerationJob["status"], string> = {
    failed: "失败",
    pending: "排队中",
    running: "生成中",
    succeeded: "已完成",
    cancelled: "已取消",
  };
  const tone: Record<GenerationJob["status"], BadgeTone> = {
    failed: "danger",
    pending: "neutral",
    running: "warning",
    succeeded: "success",
    cancelled: "neutral",
  };

  return (
    <Badge tone={tone[job.status]} className="h-8 px-2.5">
      {statusLabels[job.status]}
    </Badge>
  );
}

/** 任务结果URL，封装当前页面重复使用的转换或展示规则，并统一处理空值边界。 */
function jobResultUrl(job: GenerationJob): string | null {
  const value = job.result.url;
  // 生成结果可能来自不同 worker 或历史数据，详情页只认可明确的字符串 URL。
  return typeof value === "string" && value ? value : null;
}

/** 绝对地址媒体URL，封装当前页面重复使用的转换或展示规则，并统一处理空值边界。 */
function absoluteMediaUrl(url: string): string {
  // worker 可返回完整 URL 或后端媒体相对路径；展示层统一补齐 API 域名，不改写入库结果。
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"}${url}`;
}
