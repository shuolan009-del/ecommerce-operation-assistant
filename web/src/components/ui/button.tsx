import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactElement,
} from "react";

export type ButtonVariant = "primary" | "default" | "text" | "danger" | "brand";
export type ButtonSize = "sm" | "md";

const baseClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

// 全部使用语义类（随主题换肤）。注：primary 与 brand 按映射表同色，保留两个 variant 仅为 API 兼容。
const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  brand: "bg-brand text-white hover:bg-brand-strong",
  default: "border border-hairline bg-surface text-body hover:bg-surface-subtle",
  text: "text-body hover:text-strong",
  danger: "border border-hairline bg-surface text-danger hover:bg-danger-soft",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs", // 32px
  md: "h-9 px-3.5 text-sm", // 36px
};

/** 生成按钮/链接按钮的 className，便于在 <Link> 等非 button 元素上复用。 */
export function buttonClass(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  const { variant = "primary", size = "md", className } = opts ?? {};
  return [baseClass, variantClass[variant], sizeClass[size], className ?? ""]
    .filter(Boolean)
    .join(" ");
}

/** 原生 button，默认 type="button"（避免在 <form action=...> 中误触发提交）。 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}): ReactElement {
  return <button type={type} className={buttonClass({ variant, size, className })} {...rest} />;
}

/** 观感与 Button 一致的 a 标签（通常配合 next/link 的 Link 用 buttonClass）。 */
export function LinkButton({
  variant = "default",
  size = "md",
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}): ReactElement {
  return <a className={buttonClass({ variant, size, className })} {...rest} />;
}
