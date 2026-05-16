// Design tokens. ONE source of truth for color semantics, spacing, and type.
//
// RULES:
//   - Every color choice in components/ MUST resolve to one of PALETTE.*
//   - Do NOT introduce a new hex literal. If a use case doesn't fit an
//     existing semantic, extend this file instead of one-off styling.
//   - Exception: the per-item icon colors in lib/schedule/icons.ts are
//     intentionally varied (visual identity per category) — those bypass
//     PALETTE by design.
//
// Each PALETTE token has ONE meaning. Reusing a token for a different
// concept is exactly how amber drifted into meaning both "warning" AND
// "primary action" in the old code. Don't.

export const PALETTE = {
  // emerald-500. Used for: completed schedule items, hit-rings, "all closed"
  // moments, success toasts, optimization confidence "strong" badges.
  success:     "#10b981",
  // amber-500. Used for: streak at risk, recovery driver warnings,
  // weak-evidence flags, running-low badges, lossy-cut composition tag.
  warning:     "#f59e0b",
  // sky-500. Used for: deload week, neutral coaching info, time pills.
  info:        "#0ea5e9",
  // red-500. Used for: regression coach status, severe recovery dips,
  // delete/archive hover states.
  danger:      "#ef4444",
  // amber-300. Used for: PRs, streak milestones, celebration moments.
  // Brighter than warning to differentiate "win" from "watch out".
  celebration: "#fbbf24",
  // zinc-500. Used for: muted secondary text, inactive states.
  dim:         "#71717a",
} as const;

// Background tints — translucent variants of the palette for card chrome.
// Use these instead of hand-rolled `${color}1a` or `bg-emerald-500/5`.
export const TINT = {
  success:     "rgba(16, 185, 129, 0.08)",
  warning:     "rgba(245, 158, 11, 0.08)",
  info:        "rgba(14, 165, 233, 0.08)",
  danger:      "rgba(239, 68, 68, 0.08)",
  celebration: "rgba(251, 191, 36, 0.10)",
} as const;

// Border tints — slightly stronger than TINT, used for card outlines.
export const BORDER = {
  success:     "rgba(16, 185, 129, 0.25)",
  warning:     "rgba(245, 158, 11, 0.30)",
  info:        "rgba(14, 165, 233, 0.30)",
  danger:      "rgba(239, 68, 68, 0.30)",
  celebration: "rgba(251, 191, 36, 0.35)",
} as const;

// Spacing scale (px). Use via tailwind arbitrary values when needed:
// `gap-[${SPACING.md}px]` — but prefer the tailwind shorthand where it
// already lines up (gap-3 = 12 = SPACING.sm).
export const SPACING = {
  xs:  8,
  sm:  12,
  md:  16,
  lg:  20,
  xl:  28,
} as const;

// Typography presets. Spread into className to keep all section labels /
// body text / metrics in lockstep across the app.
export const TYPE = {
  // Tiny uppercase section label — used at the top of every Card.
  label:    "text-[10px] uppercase tracking-widest text-zinc-500",
  // Standard body — captions, descriptions, secondary copy.
  body:     "text-sm text-zinc-200",
  // Muted body — explanatory subtext.
  bodyMute: "text-xs text-zinc-400",
  // Big number for hero metrics.
  metric:   "text-2xl font-bold tabular-nums text-zinc-50",
} as const;

export type PaletteKey = keyof typeof PALETTE;
