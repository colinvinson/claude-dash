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

// Tuned for pure-black canvas. The Tailwind -500 shades are designed
// for white backgrounds; they read as harsh or muddy against pure
// black. -400 / -300 shades carry the right vibrancy + readability on
// dark mode (this is also how Apple, Stripe, Linear, Notion handle
// their dark themes).
export const PALETTE = {
  success:     "#34d399",  // emerald-400 — done / positive outcomes
  warning:     "#fbbf24",  // amber-400   — at-risk / drift signals
  info:        "#60a5fa",  // blue-400    — neutral information / time
  danger:      "#f87171",  // red-400     — regression / acute drops
  celebration: "#fcd34d",  // amber-300   — PRs / milestones / wins
  dim:         "#a1a1aa",  // zinc-400    — muted / inactive (zinc-500 disappears on pure black)
} as const;

export const TINT = {
  success:     "rgba(52, 211, 153, 0.10)",
  warning:     "rgba(251, 191, 36, 0.10)",
  info:        "rgba(96, 165, 250, 0.10)",
  danger:      "rgba(248, 113, 113, 0.10)",
  celebration: "rgba(252, 211, 77, 0.12)",
} as const;

export const BORDER = {
  success:     "rgba(52, 211, 153, 0.30)",
  warning:     "rgba(251, 191, 36, 0.32)",
  info:        "rgba(96, 165, 250, 0.32)",
  danger:      "rgba(248, 113, 113, 0.32)",
  celebration: "rgba(252, 211, 77, 0.35)",
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
// A real scale with intentional weight contrast and tightened leading on
// the larger sizes. Lean on this — every text node in components/ should
// resolve to one of these tokens, not a hand-rolled text-Nxl + font-Y.
//
// Display is the loudest moment a surface gets (daily score landing, hero
// MRR, milestone reached). Use sparingly — overuse kills its weight.

export const TYPE = {
  // ── Voice (existing — keep for backward compat) ──
  label:    "text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold",
  body:     "text-sm text-zinc-200",
  bodyMute: "text-xs text-zinc-400",
  title:    "text-base font-semibold text-zinc-100 tracking-[-0.01em]",
  metric:   "text-2xl font-bold tabular-nums text-zinc-50 tracking-[-0.02em]",
  hero:     "text-5xl font-black tabular-nums text-zinc-50 leading-none tracking-[-0.04em]",

  // ── New scale (use these for new code) ──
  // Display — the single biggest moment on a surface. Negative tracking
  // closes the gap so the number feels solid, not floaty. leading-none so
  // it doesn't fight with the surrounding rhythm.
  display:  "text-6xl font-black tabular-nums text-zinc-50 leading-none tracking-[-0.04em]",
  // Headline — section anchor + standout copy ("Day owned.", "STALE").
  headline: "text-xl font-bold text-zinc-100 tracking-[-0.015em] leading-tight",
  // Subtitle — pairs under headline / hero, more presence than caption.
  subtitle: "text-sm font-medium text-zinc-300 leading-snug",
  // Caption — small contextual text under body content.
  caption:  "text-xs text-zinc-500 leading-snug",
  // Micro — tiny uppercase tag, used for stage chips, badges. Tracked
  // wider than label so it reads at small size without crushing.
  micro:    "text-[9px] uppercase tracking-[0.22em] font-bold",
} as const;

// ── SHADOW — three depth tiers for the Card variants ───────────────────
// Card hero variant gets the deepest shadow + the inner highlight at the
// top edge (the "lit from above" Apple look). Primary is the everyday
// glass card. Inline is no shadow — just a border, used when stacking
// multiple cards inside a parent already lifted off the bg.

export const SHADOW = {
  // Hero cards get a deeper outer shadow + a stronger inner highlight at
  // the top edge — that "lit from above" gloss the premium game-launcher
  // aesthetic relies on. Subtle violet-tinted glow under the card too.
  hero:    "0 30px 80px rgba(0, 0, 0, 0.6), 0 0 24px rgba(139, 92, 246, 0.10), 0 2px 8px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.14)",
  primary: "0 12px 40px rgba(0, 0, 0, 0.45)",
  inline:  "none",
} as const;

// ── SPRING — three motion personalities for one-shot animations ────────
// EASE above is the everyday smooth curve. These are for the moments
// when smooth isn't enough — when a tap should feel springy, when a
// reveal should overshoot slightly, when a celebration needs energy.

export const SPRING = {
  smooth:  "cubic-bezier(0.22, 1, 0.36, 1)",           // alias for EASE — the everyday curve
  snappy:  "cubic-bezier(0.34, 1.56, 0.64, 1)",        // light overshoot — toggles, taps
  bounce:  "cubic-bezier(0.68, -0.55, 0.265, 1.55)",   // strong overshoot — celebrations only
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
