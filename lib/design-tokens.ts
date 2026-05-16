// Design tokens — ONE source of truth for color, spacing, type, radius,
// icon sizing, and motion.
//
// RULES (Apple-level discipline):
//   - Every color in components/ MUST resolve to PALETTE.* / TINT.* / BORDER.*
//   - Every radius MUST use RADIUS.* — no hand-rolled rounded-Xxl
//   - Every icon size MUST use ICON.*  — no size={11} oneoffs
//   - Every transition uses EASE (the single spring) at one of DURATION.*
//   - Every padding / gap pulls from SPACING.* (or aligns to the same
//     8-pt grid via tailwind shorthand: gap-2=8, gap-3=12, gap-4=16, gap-5=20)
//
// Exception: lib/schedule/icons.ts intentionally varies per-item icon
// colors for category identity — bypasses PALETTE by design.

// ── COLOR ───────────────────────────────────────────────────────────────
// Each token has ONE meaning. Reusing a token for a different concept is
// exactly the drift that made amber mean both "warning" AND "primary."

export const PALETTE = {
  success:     "#10b981",  // emerald-500 — done / positive outcomes
  warning:     "#f59e0b",  // amber-500   — at-risk / drift signals
  info:        "#0ea5e9",  // sky-500     — neutral information / time
  danger:      "#ef4444",  // red-500     — regression / acute drops
  celebration: "#fbbf24",  // amber-300   — PRs / milestones / wins
  dim:         "#71717a",  // zinc-500    — muted / inactive
} as const;

export const TINT = {
  success:     "rgba(16, 185, 129, 0.08)",
  warning:     "rgba(245, 158, 11, 0.08)",
  info:        "rgba(14, 165, 233, 0.08)",
  danger:      "rgba(239, 68, 68, 0.08)",
  celebration: "rgba(251, 191, 36, 0.10)",
} as const;

export const BORDER = {
  success:     "rgba(16, 185, 129, 0.25)",
  warning:     "rgba(245, 158, 11, 0.30)",
  info:        "rgba(14, 165, 233, 0.30)",
  danger:      "rgba(239, 68, 68, 0.30)",
  celebration: "rgba(251, 191, 36, 0.35)",
  // Neutral card outline — one value across the whole app.
  hair:        "rgba(255, 255, 255, 0.06)",
} as const;

// ── SPACING — 4pt base, doubling progression ────────────────────────────

export const SPACING = {
  xs:   4,
  sm:   8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
} as const;

// ── RADIUS — three values, period ───────────────────────────────────────
// sm: small chips, pills
// md: inputs, buttons, list rows
// lg: cards, sheets, hero elements
// All other radii rejected. Apple uses ~3 distinct corner radii too.

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 9999,
} as const;

// ── ICON — four sizes, period ───────────────────────────────────────────
// xs: meta / badge glyphs                  (10-11)
// sm: inline body-text icons               (14)
// md: standard UI icons (buttons, list)    (18)
// lg: prominent affordances                (24)

export const ICON = {
  xs: 11,
  sm: 14,
  md: 18,
  lg: 24,
} as const;

// ── TYPE — used as className spread ─────────────────────────────────────

export const TYPE = {
  // Tiny uppercase section label — used at the top of every Card.
  label:    "text-[10px] uppercase tracking-widest text-zinc-500",
  // Standard body text — descriptions, secondary copy.
  body:     "text-sm text-zinc-200",
  // Muted body — explanatory subtext.
  bodyMute: "text-xs text-zinc-400",
  // Card / row title — strong, readable, anchors a surface.
  title:    "text-base font-semibold text-zinc-100",
  // Big numeric metric (e.g. score, weight).
  metric:   "text-2xl font-bold tabular-nums text-zinc-50",
  // Hero metric — used sparingly, the centerpiece of a surface.
  hero:     "text-5xl font-black tabular-nums text-zinc-50",
} as const;

// ── MOTION — single spring, three durations ─────────────────────────────
// Every animation in the app uses EASE at one of DURATION.* values.
// Linear easings are rejected. Apple's spec is ~spring-physics for
// everything; this is the same idea expressed in a CSS-friendly form.

export const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export const DURATION = {
  fast:  150,   // micro-interactions (tap response, hover lift)
  base:  300,   // state transitions (collapse/expand, sheet open)
  slow:  500,   // emphasis moments (count-up, hero entry)
} as const;

// ── TAP TARGET — Apple HIG minimum ──────────────────────────────────────
// Anything tappable has a minimum 44pt hit area. Visual size may be
// smaller (icon button can be 18pt) but padding/margin must extend the
// tap zone to at least TAP.min.

export const TAP = {
  min: 44,  // Apple HIG floor for fingertip targets
} as const;

export type PaletteKey = keyof typeof PALETTE;
