"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// Standard button. Three variants, two sizes. Replace hand-rolled
// `<button className="px-4 py-2 rounded-xl bg-white text-zinc-900 ...">`
// inline with `<Button variant="primary">Save</Button>`.
//
// Sizing follows Apple HIG: primary tap targets ≥44pt tall.

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size    = "md" | "sm";

const VARIANT: Record<Variant, string> = {
  // White on dark — THE primary action. Only one per surface, max two.
  primary:   "bg-white text-zinc-900 hover:opacity-90 disabled:opacity-40",
  // Outlined zinc — secondary actions (cancel, back, alternate path).
  secondary: "border border-zinc-700 text-zinc-200 hover:bg-zinc-800/60 disabled:opacity-40",
  // Text-only — tertiary actions inside cards (Dismiss, Edit, "More").
  ghost:     "text-zinc-400 hover:text-zinc-100 disabled:opacity-40",
  // Red — destructive (Sign out, Delete, Archive).
  danger:    "border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-40",
};

const SIZE: Record<Size, string> = {
  // 44pt tall — Apple HIG fingertip floor. Default for any standalone CTA.
  md: "h-11 px-4 text-sm font-semibold rounded-xl",
  // 36pt — used INSIDE a card row where the button isn't the main action.
  sm: "h-9 px-3 text-xs font-semibold rounded-lg",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?:    Size;
  loading?: boolean;
  icon?:    ReactNode;
  fullWidth?: boolean;
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading = false, icon, fullWidth = false, className = "", children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-1.5",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40",
        fullWidth ? "w-full" : "",
        SIZE[size],
        VARIANT[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {icon && !loading && <span className="flex-shrink-0">{icon}</span>}
      {loading ? "…" : children}
    </button>
  );
});

export default Button;
