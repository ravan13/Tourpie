"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[linear-gradient(135deg,_rgba(2,42,107,0.98),_rgba(12,60,125,0.94)_55%,_rgba(255,106,26,0.94))] text-white shadow-[0_20px_48px_rgba(2,42,107,0.22)] hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(2,42,107,0.28)]",
  secondary:
    "border-white/70 bg-white/85 text-slate-900 shadow-[0_18px_44px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_24px_54px_rgba(15,23,42,0.12)]",
  soft:
    "border-blue-100/80 bg-blue-50/80 text-blue-900 shadow-[0_14px_34px_rgba(59,130,246,0.10)] hover:-translate-y-0.5 hover:bg-blue-50",
  ghost:
    "border-transparent bg-transparent text-slate-700 shadow-none hover:bg-white/70 hover:text-slate-950",
  danger:
    "border-red-200/80 bg-red-50/90 text-red-700 shadow-[0_14px_34px_rgba(239,68,68,0.10)] hover:-translate-y-0.5 hover:bg-red-100/90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-10 rounded-[1rem] px-4 text-sm",
  md: "min-h-12 rounded-[1.15rem] px-5 text-sm",
  lg: "min-h-14 rounded-[1.35rem] px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    leadingIcon,
    trailingIcon,
    disabled,
    children,
    type,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={joinClasses(
        "inline-flex items-center justify-center gap-2 border font-black tracking-[-0.01em] whitespace-nowrap transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 outline-none focus-visible:ring-4 focus-visible:ring-blue-100/90 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60",
        sizeClasses[size],
        variantClasses[variant],
        fullWidth && "w-full",
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="h-2.5 w-2.5 rounded-full bg-current/80" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!loading ? trailingIcon : null}
    </button>
  );
});
