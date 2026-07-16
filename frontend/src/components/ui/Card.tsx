"use client";

import { forwardRef, type HTMLAttributes } from "react";

type CardVariant = "glass" | "solid" | "muted";
type CardPadding = "sm" | "md" | "lg";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: CardPadding;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const variantClasses: Record<CardVariant, string> = {
  glass:
    "border-white/70 bg-white/80 shadow-[0_26px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl",
  solid:
    "border-gray-100 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]",
  muted:
    "border-gray-100 bg-gray-50/90 shadow-[0_14px_34px_rgba(15,23,42,0.06)]",
};

const paddingClasses: Record<CardPadding, string> = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = "glass", padding = "md", children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={joinClasses(
        "rounded-[2rem] border transition-[transform,box-shadow,background-color,border-color] duration-200",
        variantClasses[variant],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClasses("flex flex-col gap-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={joinClasses("text-xl font-black tracking-[-0.03em] text-slate-950", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={joinClasses("text-sm font-medium leading-6 text-slate-600", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClasses("mt-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClasses("mt-6 flex flex-wrap items-center gap-3", className)} {...props} />;
}
