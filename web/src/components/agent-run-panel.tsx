"use client";

import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  LoaderCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AgentDraftOutput, AgentRun, AgentRunStatus } from "@/types";

import { Badge, Button, EmptyState, Field, FormAlert, Input, Textarea } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";

type AgentRunPanelProps = {
  productId: number;
  initialRuns: AgentRun[];
  canEdit: boolean;
};

const activeStatuses: AgentRunStatus[] = ["queued", "running", "awaiting_review", "resume_queued"];

const specialistSteps = [
  { key: "product_context_agent", label: "商品上下文", icon: Bot },
  { key: "diagnosis_agent", label: "运营诊断", icon: Sparkles },
  { key: "creative_strategy_agent", label: "创意策略", icon: FileCheck2 },
  { key: "quality_review_agent", label: "质量审核", icon: ShieldCheck },
] as const;

/** 渲染 AgentRunPanel 组件，集中展示Agent运行面板所需的数据、状态和操作入口。 */
export function AgentRunPanel({ productId, initialRuns, canEdit }: AgentRunPanelProps) {
  const [runs, setRuns] = useState(initialRuns);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const latestRun = runs[0] ?? null;
  const [draftJson, setDraftJson] = useState(() => formatDraft(latestRun));
  const latestRunId = latestRun?.id;
  const latestRunStatus = latestRun?.status;

  useEffect(() => {
    if (!latestRunId || !latestRunStatus || !["queued", "running", "resume_queued"].includes(latestRunStatus)) {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/agent-runs/${latestRunId}`, { cache: "no-store" });
        if (!response.ok) return;
        const updated = (await response.json()) as AgentRun;
        setRuns((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
        if (updated.status === "awaiting_review") {
          setDraftJson(formatDraft(updated));
        }
      } catch {
        // 短时轮询失败不打断用户操作，下一轮继续读取 Celery 运行状态。
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [latestRunId, latestRunStatus]);

  const hasActiveRun = latestRun ? activeStatuses.includes(latestRun.status) : false;
  const latestEvents = useMemo(
    () => [...(latestRun?.events ?? [])].sort((a, b) => b.id - a.id).slice(0, 12),
    [latestRun?.events],
  );

  /** 处理启动运行交互，维护必要状态并把副作用交给受控路由或后端 API。 */
  async function startRun() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/products/${productId}/agent-runs`, { method: "POST" });
      const run = await readResponse(response);
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setDraftJson(formatDraft(run));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "启动 Agent 失败");
    } finally {
      setSubmitting(false);
    }
  }

  /** 处理提交复盘交互，维护必要状态并把副作用交给受控路由或后端 API。 */
  async function submitReview(decision: "approve" | "edit_and_approve" | "reject") {
    if (!latestRun) return;
    setSubmitting(true);
    setError(null);
    try {
      let editedOutput: AgentDraftOutput | undefined;
      if (decision === "edit_and_approve") {
        editedOutput = JSON.parse(draftJson) as AgentDraftOutput;
        if (!editedOutput.diagnosis || !Array.isArray(editedOutput.creative_plans)) {
          throw new Error("编辑内容必须包含 diagnosis 和 creative_plans");
        }
      }
      const response = await fetch(`/agent-runs/${latestRun.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          note: reviewNote.trim() || null,
          ...(editedOutput ? { edited_output: editedOutput } : {}),
        }),
      });
      const run = await readResponse(response);
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "提交审核失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
      <div className="grid gap-6">
        <div className="rounded-lg border border-hairline bg-surface p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <Bot className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-semibold">商品运营 Agent</span>
              </div>
              <h2 className="mt-2 text-xl font-semibold text-strong">从商品信息到可审核运营方案</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-body">
                内部专家按固定流程协作，质量不达标最多返修一次；最终结果只有人工确认后才写入诊断和创意方案。
              </p>
            </div>
            <Button
              variant="brand"
              onClick={startRun}
              disabled={!canEdit || submitting || hasActiveRun}
            >
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {hasActiveRun ? "运行进行中" : "启动运营 Agent"}
            </Button>
          </div>
          {error ? (
            <FormAlert tone="error" className="mt-4">
              <span className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </span>
            </FormAlert>
          ) : null}
        </div>

        {latestRun ? (
          <>
            <div className="rounded-lg border border-hairline bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Run #{latestRun.id} · v{latestRun.workflow_version}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">专家协作进度</h3>
                </div>
                <RunStatusBadge status={latestRun.status} />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {specialistSteps.map((step) => {
                  const state = specialistState(latestRun, step.key);
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="rounded-lg border border-hairline bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <Icon className="h-5 w-5 text-body" aria-hidden="true" />
                        <StepStateIcon state={state} />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-strong">{step.label}</p>
                      <p className="mt-1 text-xs text-body">{stepStateLabel(state)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-body">
                <span>返修 {latestRun.revision_count}/{latestRun.max_revisions}</span>
                <span>模型调用 {numberValue(latestRun.usage.calls)} 次</span>
                <span>Token {numberValue(latestRun.usage.total_tokens)}</span>
              </div>
            </div>

            <QualityPanel run={latestRun} />
            {latestRun.status === "awaiting_review" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
                <div className="flex items-center gap-2 text-amber-800">
                  <UserCheck className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">等待人工审核</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-amber-800/80">
                  可直接通过、编辑完整结构化草稿后通过，或驳回。本步骤不会自动执行投放或资金操作。
                </p>
                <Field label="结构化草稿（可编辑）" htmlFor="agent-draft-json" className="mt-5">
                  <Textarea
                    id="agent-draft-json"
                    value={draftJson}
                    onChange={(event) => setDraftJson(event.target.value)}
                    rows={20}
                    spellCheck={false}
                    className="font-mono"
                  />
                </Field>
                <Field label="审核备注" htmlFor="agent-review-note" className="mt-4">
                  <Input
                    id="agent-review-note"
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="可选：记录修改原因或驳回原因"
                  />
                </Field>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="primary" disabled={submitting || !canEdit} onClick={() => submitReview("approve")}>
                    直接通过
                  </Button>
                  <Button
                    variant="primary"
                    disabled={submitting || !canEdit}
                    onClick={() => submitReview("edit_and_approve")}
                  >
                    保存编辑并通过
                  </Button>
                  <Button variant="danger" disabled={submitting || !canEdit} onClick={() => submitReview("reject")}>
                    驳回
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-surface">
            <EmptyState
              icon={<Bot className="h-5 w-5" />}
              title="还没有 Agent 运行记录"
              description="启动后将显示专家协作、质量检查和人工审批过程。"
            />
          </div>
        )}
      </div>

      <aside className="grid content-start gap-6">
        <div className="rounded-lg border border-hairline bg-surface p-5">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-body" />
            <h3 className="font-semibold">运行轨迹</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {latestEvents.length ? (
              latestEvents.map((event) => (
                <div key={event.id} className="border-l-2 border-hairline pl-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-strong">{eventLabel(event.event_type)}</p>
                    <span className="text-[11px] text-muted">{formatTime(event.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-body">
                    {event.message ?? agentLabel(event.agent_name)}
                  </p>
                  {event.metrics.latency_ms ? (
                    <p className="mt-1 text-[11px] text-muted">耗时 {String(event.metrics.latency_ms)} ms</p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState compact title="暂无运行事件" />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-hairline bg-surface p-5">
          <h3 className="font-semibold">最近运行</h3>
          <div className="mt-4 grid gap-2">
            {runs.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5 transition-colors hover:bg-surface-subtle"
              >
                <div>
                  <p className="text-sm font-medium">Run #{run.id}</p>
                  <p className="mt-0.5 text-xs text-muted">{formatTime(run.created_at)}</p>
                </div>
                <RunStatusBadge status={run.status} />
              </div>
            ))}
            {!runs.length ? <EmptyState compact title="暂无记录" /> : null}
          </div>
        </div>
      </aside>
    </section>
  );
}

/** 渲染 QualityPanel 组件，集中展示quality面板所需的数据、状态和操作入口。 */
function QualityPanel({ run }: { run: AgentRun }) {
  const report = run.quality_report;
  if (typeof report.score !== "number") return null;
  return (
    <div className="rounded-lg border border-hairline bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <h3 className="text-lg font-semibold">质量审核</h3>
        </div>
        <span className={`text-lg font-semibold ${report.passed ? "text-emerald-700" : "text-amber-700"}`}>
          {report.score} 分
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        {(report.issues ?? []).length ? (
          report.issues?.map((issue) => (
            <div key={`${issue.code}-${issue.field}`} className="flex items-start gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm">
              {issue.severity === "error" ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <span className="text-body">{issue.message}</span>
            </div>
          ))
        ) : (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> 结构、差异性与合规规则检查通过
          </p>
        )}
      </div>
    </div>
  );
}

/** 渲染 RunStatusBadge 组件，集中展示运行状态状态徽标所需的数据、状态和操作入口。 */
function RunStatusBadge({ status }: { status: AgentRunStatus }) {
  const labels: Record<AgentRunStatus, string> = {
    queued: "排队中",
    running: "执行中",
    awaiting_review: "待审核",
    resume_queued: "恢复排队",
    completed: "已完成",
    rejected: "已驳回",
    failed: "失败",
    cancelled: "已取消",
  };
  const tones: Record<AgentRunStatus, BadgeTone> = {
    queued: "info",
    running: "info",
    awaiting_review: "warning",
    resume_queued: "info",
    completed: "success",
    rejected: "danger",
    failed: "danger",
    cancelled: "neutral",
  };
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

/** 渲染 StepStateIcon 组件，集中展示stepstateicon所需的数据、状态和操作入口。 */
function StepStateIcon({ state }: { state: "pending" | "running" | "completed" | "failed" }) {
  if (state === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (state === "failed") return <XCircle className="h-4 w-4 text-rose-600" />;
  if (state === "running") return <RefreshCw className="h-4 w-4 animate-spin text-sky-600" />;
  return <Clock3 className="h-4 w-4 text-slate-300" />;
}

/** specialiststate，封装当前页面重复使用的转换或展示规则，并统一处理空值边界。 */
function specialistState(run: AgentRun, agentName: string) {
  if (run.events.some((event) => event.agent_name === agentName && event.status === "failed")) return "failed" as const;
  if (run.current_agent === agentName && run.status === "running") return "running" as const;
  if (run.events.some((event) => event.agent_name === agentName && event.event_type === "agent_step_completed")) return "completed" as const;
  return "pending" as const;
}

/** 把stepstate状态映射为中文显示文本，保持页面口径一致。 */
function stepStateLabel(state: "pending" | "running" | "completed" | "failed") {
  return { pending: "等待执行", running: "正在处理", completed: "已完成", failed: "执行失败" }[state];
}

/** 格式化draft，统一空值、本地化和页面展示规则，避免各组件重复格式化。 */
function formatDraft(run: AgentRun | null) {
  if (!run?.draft_output?.diagnosis || !run.draft_output.creative_plans) return "";
  return JSON.stringify(run.draft_output, null, 2);
}

/** 读取响应，封装当前页面重复使用的转换或展示规则，并统一处理空值边界。 */
async function readResponse(response: Response): Promise<AgentRun> {
  const payload = (await response.json()) as AgentRun & { detail?: string };
  if (!response.ok) throw new Error(payload.detail ?? `请求失败（${response.status}）`);
  return payload;
}

/** 数值值，把不可信表单或 JSON 值转换为页面逻辑可安全使用的类型。 */
function numberValue(value: unknown) {
  return typeof value === "number" ? value : 0;
}

/** 把Agent状态映射为中文显示文本，保持页面口径一致。 */
function agentLabel(agentName: string | null) {
  return specialistSteps.find((step) => step.key === agentName)?.label ?? agentName ?? "工作流";
}

/** 把事件状态映射为中文显示文本，保持页面口径一致。 */
function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    queued: "已进入队列",
    workflow_started: "工作流启动",
    workflow_resumed: "工作流恢复",
    agent_step_started: "专家开始处理",
    agent_step_completed: "专家处理完成",
    agent_step_failed: "专家处理失败",
    revision_requested: "质量返修",
    human_review_requested: "等待人工审核",
    resume_queued: "审核已提交",
    human_review_received: "收到人工决定",
  };
  return labels[eventType] ?? eventType;
}

/** 格式化time，统一空值、本地化和页面展示规则，避免各组件重复格式化。 */
function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
