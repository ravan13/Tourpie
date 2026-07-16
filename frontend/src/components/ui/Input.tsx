"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type InputTone = "default" | "error" | "success";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  tone?: InputTone;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const toneClasses: Record<InputTone, string> = {
  default:
    "border-white/75 bg-white/86 text-slate-900 shadow-[0_16px_40px_rgba(15,23,42,0.08)] focus-within:border-blue-200 focus-within:ring-4 focus-within:ring-blue-100/80",
  error:
    "border-red-200 bg-red-50/90 text-slate-900 shadow-[0_16px_40px_rgba(239,68,68,0.08)] focus-within:border-red-300 focus-within:ring-4 focus-within:ring-red-100/80",
  success:
    "border-emerald-200 bg-emerald-50/80 text-slate-900 shadow-[0_16px_40px_rgba(16,185,129,0.08)] focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-100/80",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, tone = "default", leadingIcon, trailingIcon, id, ...props },
  ref
) {
  const resolvedTone = error ? "error" : tone;
  const helperText = error || hint;
  const helperTone = error ? "text-red-600" : resolvedTone === "success" ? "text-emerald-600" : "text-slate-500";

  return (
    <label className="flex w-full flex-col gap-2">
      {label ? <span className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span> : null}
      <span
        className={joinClasses(
          "group flex min-h-14 items-center gap-3 rounded-[1.4rem] border px-4 transition-[box-shadow,border-color,background-color] duration-200",
          toneClasses[resolvedTone]
        )}
      >
        {leadingIcon ? <span className="shrink-0 text-slate-400">{leadingIcon}</span> : null}
        <input
          ref={ref}
          id={id}
          className={joinClasses(
            "w-full bg-transparent text-sm font-bold text-inherit placeholder:text-slate-400/90 outline-none disabled:cursor-not-allowed disabled:opacity-70",
            className
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {trailingIcon ? <span className="shrink-0 text-slate-400">{trailingIcon}</span> : null}
      </span>
      {helperText ? <span className={joinClasses("text-xs font-bold", helperTone)}>{helperText}</span> : null}
    </label>
  );
});
