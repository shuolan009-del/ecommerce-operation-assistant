import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/** 表单标签文字样式。 */
export const labelClass = "block text-sm font-medium text-body";

const controlBase =
  "w-full rounded-md border border-hairline bg-surface px-3 text-sm text-strong outline-none transition-colors placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60";

/** 单行输入框样式（高 40px）。 */
export const inputClass = `h-10 ${controlBase}`;

/** 下拉选择框样式（显式保留 bg-surface，避免部分浏览器下拉呈灰底）。 */
export const selectClass = `h-10 ${controlBase}`;

/** 多行文本框样式（高度自适应，可纵向拉伸）。 */
export const textareaClass = `min-h-24 resize-y py-2.5 ${controlBase}`;

/** 表单字段：标签在上、控件在下，可选提示文字；渲染为 <label> 以便点击标签聚焦控件。 */
export function Field({
  label,
  htmlFor,
  hint,
  required = false,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <label htmlFor={htmlFor} className={[labelClass, className ?? ""].filter(Boolean).join(" ")}>
      <span>
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </label>
  );
}

/** 单行输入框，透传全部原生属性。 */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return <input className={[inputClass, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}

/** 下拉选择框，透传全部原生属性。 */
export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>): ReactElement {
  return <select className={[selectClass, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}

/** 多行文本框，透传全部原生属性。 */
export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  return <textarea className={[textareaClass, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}

export type FormAlertTone = "error" | "success" | "warning" | "info";

const alertToneClass: Record<FormAlertTone, string> = {
  error: "border-danger/30 bg-danger-soft text-danger",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  info: "border-info/30 bg-info-soft text-info",
};

/** 表单提示条，默认 error。 */
export function FormAlert({
  tone = "error",
  children,
  className,
}: {
  tone?: FormAlertTone;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={[
        "rounded-md border px-3 py-2 text-sm",
        alertToneClass[tone],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
