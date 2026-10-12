import type { CreativePlan } from "@/types";

import { Button, Field, Input, Textarea } from "@/components/ui";

type VideoScriptEditFormProps = {
  productId: number;
  script: CreativePlan;
};

/** 渲染 VideoScriptEditForm 组件，集中展示视频script编辑表单所需的数据、状态和操作入口。 */
export function VideoScriptEditForm({ productId, script }: VideoScriptEditFormProps) {
  return (
    <form
      action={`/products/${productId}/creative-plans/${script.id}/video-script/update`}
      method="post"
      className="mt-4 grid gap-3 border-t border-hairline pt-4"
    >
      <Field label="脚本标题">
        <Input name="title" defaultValue={script.title} />
      </Field>

      <Field label="测试角度">
        <Textarea name="angle" defaultValue={planText(script.content, "angle")} rows={2} />
      </Field>

      <div className="grid gap-3 md:grid-cols-[1fr_140px]">
        <Field label="开头钩子">
          <Input name="hook" defaultValue={planText(script.content, "hook")} />
        </Field>
        <Field label="时长/秒">
          <Input
            name="duration_seconds"
            type="number"
            min={15}
            max={60}
            defaultValue={planValue(script.content, "duration_seconds")}
          />
        </Field>
      </div>

      {/* 分镜用 JSON 编辑是为了保留结构化镜头数据，后端会解析并写回 content.scenes。 */}
      <Field label="镜头分镜 JSON">
        <Textarea
          name="scenes_json"
          defaultValue={JSON.stringify(planScenes(script.content), null, 2)}
          rows={10}
          className="font-mono"
        />
      </Field>

      <Field label="卖点证明">
        <Textarea name="selling_point_proof" defaultValue={planList(script.content, "selling_point_proof").join("\n")} rows={3} />
      </Field>

      <Field label="转化引导">
        <Textarea name="cta" defaultValue={planText(script.content, "cta")} rows={2} />
      </Field>

      <Field label="视频生成提示词">
        <Textarea name="video_prompt" defaultValue={planText(script.content, "video_prompt")} rows={3} />
      </Field>

      {/* 参考图、字幕、配音和剪辑备注都走可编辑字段，避免视频生成变成只读黑盒。 */}
      <Field label="参考图 URL">
        <Textarea
          name="reference_images"
          defaultValue={planList(script.content, "reference_images").join("\n")}
          rows={3}
          placeholder="每行一张参考图，用于图生视频或保持商品外观一致"
        />
      </Field>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="字幕">
          <Textarea name="subtitle_lines" defaultValue={planList(script.content, "subtitle_lines").join("\n")} rows={4} />
        </Field>
        <Field label="配音文案">
          <Textarea name="voiceover_text" defaultValue={planText(script.content, "voiceover_text")} rows={4} />
        </Field>
      </div>

      <Field label="剪辑备注">
        <Textarea name="edit_notes" defaultValue={planText(script.content, "edit_notes")} rows={3} />
      </Field>

      <Button type="submit" variant="primary">
        保存修改
      </Button>
    </form>
  );
}

/** 方案文本，把不可信表单或 JSON 值转换为页面逻辑可安全使用的类型。 */
function planText(content: Record<string, unknown>, key: string): string {
  const value = content[key];
  return typeof value === "string" ? value : "";
}

/** 方案值，把不可信表单或 JSON 值转换为页面逻辑可安全使用的类型。 */
function planValue(content: Record<string, unknown>, key: string): string {
  const value = content[key];
  if (typeof value === "number") {
    return String(value);
  }
  return typeof value === "string" ? value : "";
}

/** 方案列表，把不可信表单或 JSON 值转换为页面逻辑可安全使用的类型。 */
function planList(content: Record<string, unknown>, key: string): string[] {
  const value = content[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** 方案scenes，把不可信表单或 JSON 值转换为页面逻辑可安全使用的类型。 */
function planScenes(content: Record<string, unknown>): Array<{
  shot: string;
  visual: string;
  voiceover: string;
}> {
  // 分镜 content 可能为空或格式不完整，表单只渲染可安全编辑的 shot/visual/voiceover 字段。
  const scenes = content.scenes;
  if (!Array.isArray(scenes)) {
    return [];
  }

  return scenes
    .filter((scene): scene is Record<string, unknown> => Boolean(scene) && typeof scene === "object")
    .map((scene) => ({
      shot: typeof scene.shot === "string" ? scene.shot : "",
      visual: typeof scene.visual === "string" ? scene.visual : "",
      voiceover: typeof scene.voiceover === "string" ? scene.voiceover : "",
    }));
}
