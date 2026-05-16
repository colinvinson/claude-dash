# Design system — read before building UI

This doc exists because the app grew feature-by-feature for months and ended up with 16 cards on Home, 4 ways to render "done," and amber meaning both "warning" AND "primary action." This is the antidote. Reuse what's here; extend the system when you genuinely need to, don't fork it.

## Primitives — what to import, never hand-roll

| Need | Use this | Path |
|------|----------|------|
| Card chrome (glass background + border + padding) | `Card` | [components/ui/Card.tsx](Card.tsx) |
| "Mark as done" interaction (any size) | `CompletionToggle` | [components/ui/CompletionToggle.tsx](CompletionToggle.tsx) |
| Text input | `FormInput` | [components/ui/FormInput.tsx](FormInput.tsx) |
| Textarea | `FormTextarea` | [components/ui/FormInput.tsx](FormInput.tsx) |
| Select dropdown | `FormSelect` | [components/ui/FormInput.tsx](FormInput.tsx) |
| Form field label | `FormLabel` (use `optional` prop) | [components/ui/FormLabel.tsx](FormLabel.tsx) |
| "Nothing to show" surface | `EmptyState` | [components/ui/EmptyState.tsx](EmptyState.tsx) |
| Celebratory burst | `ConfettiBurst` | [components/ui/ConfettiBurst.tsx](ConfettiBurst.tsx) |

**If a primitive doesn't fit your case**, add a mode/prop to the primitive rather than hand-rolling around it. Forks compound — every divergence becomes another inconsistency a year from now.

---

## Color semantics — each PALETTE token has ONE meaning

Defined in [lib/design-tokens.ts](../../lib/design-tokens.ts). Use the constants; do not introduce hex literals in components.

| Token | Color | ONLY used for |
|-------|-------|---------------|
| `PALETTE.success` | emerald-500 `#10b981` | Completed items, hit rings, all-closed states, success toasts, "strong" confidence badges |
| `PALETTE.warning` | amber-500 `#f59e0b` | At-risk states, recovery drivers, weak-evidence flags, running-low badges, lossy-cut composition |
| `PALETTE.info` | sky-500 `#0ea5e9` | Deload week, neutral coaching info, time-related pills |
| `PALETTE.danger` | red-500 `#ef4444` | REGRESSION coach status, severe recovery, delete/archive hover |
| `PALETTE.celebration` | amber-300 `#fbbf24` | PRs, streak milestones, Jarvis research moments. Brighter than warning to differentiate "win" from "watch out" |
| `PALETTE.dim` | zinc-500 `#71717a` | Muted secondary text, inactive states |

Plus `TINT.*` (translucent background variant) and `BORDER.*` (slightly stronger outline variant) for the same six semantics.

**Never** reuse a token for a different concept. The old code had amber mean both "warning" AND "primary action" — that's exactly the drift this kills. Primary action is **white** (`bg-white text-zinc-900`). Secondary action is **bordered zinc** (`border-zinc-700`).

**Exception:** [lib/schedule/icons.ts](../../lib/schedule/icons.ts) intentionally varies per-item icon colors for category identity. That's an outlier by design and doesn't go through PALETTE.

---

## Typography — use TYPE constants

```ts
import { TYPE } from "@/lib/design-tokens";

TYPE.label    // "text-[10px] uppercase tracking-widest text-zinc-500" — section header on every Card
TYPE.body     // "text-sm text-zinc-200"     — body copy
TYPE.bodyMute // "text-xs text-zinc-400"     — explanatory subtext
TYPE.metric   // "text-2xl font-bold tabular-nums text-zinc-50" — big numbers
```

If you find yourself writing `text-[10px] uppercase tracking-widest` inline, that's `TYPE.label`. Use the constant.

---

## What goes on Home — the rule

Home answers two questions: **"what should I do right now?"** and **"how am I doing today?"** Everything else lives on its dedicated tab.

- ✅ Today's progress (TodayWrap, PriorityFocusCard)
- ✅ Today's actions (RightNowCard, DayBrief)
- ✅ Today's edge states (StreakAlert, TodaysCall, WelcomeCard) — conditional
- ❌ Historical analysis → Data tab
- ❌ Weekly summaries → live as one-off jarvis_insights or in Data
- ❌ Tab-specific tools (workouts, schedule, etc.) → their own tabs

When you add a feature, ask: does the user need this on Home, or does it belong on the relevant tab? Default to the tab. Home is a triage surface, not a feature bin.

---

## Add flows — when inline, when sheet

| Surface | Pattern |
|---------|---------|
| Quick high-frequency add (water, schedule item, set) | **Inline** — small row of `FormInput`s + primary button at the bottom of the relevant card |
| Rich add with many fields (schedule item edit, goal protocol, exercise definition) | **Sheet** — full-height modal sliding up from below |
| Decision fork (manual vs. AI-drafted) | **Two-button card** that morphs into the chosen path |

All forms use `FormInput` / `FormLabel` / `FormTextarea` / `FormSelect`. Primary action = `bg-white text-zinc-900`. Secondary = bordered zinc.

---

## Completion checks — always `CompletionToggle`

Three modes:
- `mode="large"` — 36px circle with item icon visible when un-done, big check + confetti burst when done. Schedule rows.
- `mode="small"` — 24px circle. Home priority goals, anywhere with a tight row.
- `mode="glyph"` — 20px outline, minimal. Workout set "done" indicator etc.

Never hand-roll a check circle. If you need a new size or interaction, add a mode to `CompletionToggle`.

---

## When adding a NEW UI feature

Walk through this list before writing any component code:

1. **Is there already a surface for this?** Open the relevant tab, look at every card. If something overlaps, extend the existing surface instead of adding a new card.
2. **Which primitives do I need?** Card, CompletionToggle, FormInput etc. Import from `components/ui/`.
3. **Which color semantic applies?** If none fits, you probably don't need a new color — re-read the table above. Real exceptions extend `PALETTE`, not introduce a one-off hex.
4. **Does this belong on Home?** Probably not. Default to the dedicated tab.
5. **What's the empty state?** Use `EmptyState`.

If you can't fit the feature into this system, that's signal the feature OR the system needs to evolve — not that you should branch styling. Update this doc when the system changes.
