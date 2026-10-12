import type { CreativePlan } from "@/types";

import { Button, Field, Input, Textarea } from "@/components/ui";

type MainImagePlanEditFormProps = {
  productId: number;
  plan: CreativePlan;
};

/** 渲染 MainImagePlanEditForm 组件，集中展示主图图片方案编辑表单所需的数据、状态和操作入口。 */
export function MainImagePlanEditForm({ productId, plan }: MainImagePlanEditFormProps) {
  return (
    <form
      action={`/products/${productId}/creative-plans/${plan.id}/main-image/update`}
      method="post"
      className="mt-4 grid gap-3 border-t border-hairline pt-4"
    >
      {/* AI 生成的主图方案必须允许人工改文案、布局和 prompt，保存后仍回写为结构化 content。 */}
      <Field label="方案标题">
        <Input name="title" defaultValue={plan.title} />
      </Field>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="主文案">
          <Input name="headline" defaultValue={planText(plan.content, "headline")} />
        </Field>
        <Field label="副文案">
          <Input name="sub_headline" defaultValue={planText(plan.content, "sub_headline")} />
        </Field>
      </div>

      <Field label="测试角度">
        <Textarea name="angle" defaultValue={planText(plan.content, "angle")} rows={2} />
      </Field>

      <Field label="画面布局">
        <Textarea name="layout" defaultValue={planText(plan.content, "layout")} rows={3} />
      </Field>

      <Field label="视觉重点">
        <Textarea name="visual_focus" defaultValue={planText(plan.content, "visual_focus")} rows={3} />
      </Field>

      <Field label="证明点">
        <Textarea name="proof_points" defaultValue={planList(plan.content, "proof_points").join("\n")} rows={3} />
      </Field>

      <Field label="图片生成提示词">
        <Textarea name="image_prompt" defaultValue={planText(plan.content, "image_prompt")} rows={3} />
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

/** 方案列表，把不可信表单或 JSON 值转换为页面逻辑可安全使用的类型。 */
function planList(content: Record<string, unknown>, key: string): string[] {
  const value = content[key];
  // content 可能来自旧数据或人工编辑，读取列表字段时做类型收窄，坏值只显示为空。
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
