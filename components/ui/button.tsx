import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      asChild = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    const baseStyles =
      "inline-flex items-center justify-center rounded-editorial text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ink disabled:pointer-events-none disabled:opacity-50 tracking-tight";

    const variants = {
      primary:
        "bg-brand-ink text-brand-canvas hover:bg-brand-ink/90 shadow-editorial hover:shadow-editorial-hover hover:-translate-y-[1px]",
      secondary:
        "bg-brand-surface border border-brand-border text-brand-ink hover:border-brand-ink/30 hover:bg-brand-canvas shadow-sm",
      ghost:
        "text-brand-muted hover:text-brand-ink hover:bg-brand-ink/5",
    };

    const sizes = {
      sm: "h-8 px-4 text-xs",
      md: "h-10 px-6 py-2",
      lg: "h-12 px-8 text-base",
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";