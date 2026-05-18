# Rowan V2 Feature Map

> The reference doc for the Rowan V2 rebuild. Updated each phase so
> future work knows where every feature lives + what merges into what.

## Architecture in one sentence

Miles OS's visual + structural shell — top rail nav, numbered card sections, 3-column dashboards, dark + emerald + monospace aesthetic — wrapping every Rowan feature, smartly merged so nothing duplicates.

## Tab layout (TopRail order)

| Tab | Route | What lives here |
|---|---|---|
| HOME | `/home` | 3-column dashboard (Operator + Session + Habits + Calendar + Key Blockers + Finance Pulse + Nutrition). The cockpit. |
| SCHEDULE | `/schedule` | Routine items (supplement_stack). Full edit surface. Habits card on Home is the daily-view tip. |
| GYM | `/gym` | Hypertrophy coach + mesocycles + workout logging. |
| LIFE | `/life` | Long-term goals + milestones + metrics. |
| BIZ | `/businesses` | Businesses portfolio: per-business tasks, agents, marketing experiments, linked chats. |
| MONEY | `/finances` | Net worth hero + asset breakdown + history + Strategy/Wishlist/CashFlow. |

**Coming in later phases:**
- CRM (Phase 4) — cross-cutting kanban of every open task across businesses + goals. Doesn't replace Biz; complements it.
- REVIEW (Phase 5) — promoted MonthlyRetro + weekly retros form. Replaces in-Home retro surface.
- BRAIN (Phase 7) — memory_chunks search (pgvector) + ask-my-OS endpoint over the full data corpus.
- JOURNAL (Phase 7) — long-form entries.

## Home page — card-by-card source map (Phase 2 shipped)

| Card | Component | Data source | Notes |
|---|---|---|---|
| 01 // OPERATOR | `OperatorCard` | `useSettings`, `useGoals`, `useDailyContext` | Name + role + focus + streak. ONLINE pulse. |
| 02 // SESSION | `SessionCard` | `useSettings`, `useDailyContext` | Italic greeting + live clock + "Today I will" + capture box (Phase 7 wires real pipeline). |
| 03 // HABITS | `HabitsCard` | `useStack` | First 6 today's routine items + score ring. Tap to toggle. |
| 04 // CALENDAR | `CalendarCard` | `useStack` + `useWorkout` | 7-day strip + today's blocks (scheduled routine + workout sessions). |
| 06 // KEY BLOCKERS | `KeyBlockersCard` | `business_tasks` + `goal_milestones` | Top 5 open across both. HOT/WARM heat by age + due. |
| 07 // FINANCE PULSE | `FinancePulseCard` | `useNetWorth` | Mini net worth + sparkline + monthly/daily delta tiles. |
| 08 // NUTRITION | `NutritionCard` | `useProtein` | Big kcal + macros + meal log + cutoff timer. Carbs/fat are placeholders until macro logging lands. |

**Old Home cards deprecated (files kept on disk, unmounted from `home/page.tsx`):**
- `WelcomeCard` — first-time only, low value, absorbed by Operator
- `TodaysCall` — severity alerts; will absorb into a future "alerts banner" above the grid if needed
- `StreakAlert` — at-risk; the streak in Operator already covers this signal
- `MonthlyRetroCard` → moves to Review tab (Phase 5)
- `DayBrief` → AI summary moves to Brain/Review (Phase 7)
- `TodayWrap` → daily score number could surface in Operator badge later
- `WhatMattersCard` → absorbed into Key Blockers + Operator focus
- `QuickStatsStrip` → absorbed into Habits card

**Top rail (`components/layout/TopRail.tsx`)**:
- Brand left ("ROWAN OS // V1.0" with emerald pulse dot)
- Tabs centered (desktop only — mobile uses BottomNav)
- Biometrics ticker (SLEEP / READINESS / HRV) in his BTC/NDX/XAU slot
- Live clock + date
- `+` opens LogSheet (the 9-dimension logger)
- Avatar initials

## Feature → home reference map (where each Rowan feature lives in V2)

| Rowan feature | V2 location | How it merges |
|---|---|---|
| Profile | Settings + surfaces in OperatorCard | Existing useSettings stays. ProfileEditor restyled later. |
| Long-term goals + milestones + metrics | `/life` tab | Visual restyle in Phase 6. Milestones surface in KeyBlockers. |
| Businesses portfolio | `/businesses` tab | Visual restyle in Phase 6. Open tasks surface in KeyBlockers. |
| Business agents + cron + artifacts | Inside BusinessDetail | Untouched architecturally; visual restyle in Phase 6. |
| Marketing experiments | Inside BusinessDetail | Same as above. |
| Hypertrophy coach + mesocycles | `/gym` tab | Visual restyle in Phase 6. Workout sessions surface as Calendar blocks. |
| Supplement stack + schedule | `/schedule` tab | Today's 6 surface in HabitsCard on Home. |
| Oura health_logs | `health_logs` table + TopRail ticker | Sleep/Readiness/HRV in the rail. Full data lives in (future) Health subview. |
| Wake-on-time scoring | `lib/scoring.ts` component | Continues to score; visible on score readouts. |
| 9 dimension logs (focus/social/cardio/libido/aesthetic/caffeine/sun/learning/money) | `LogSheet` via `+` in TopRail | Aggregated views can surface in Phase 6 (Health subview). |
| Daily context (morning plan) | OperatorCard + SessionCard | Single source of truth: `daily_context` table. |
| Jarvis chat | `/jarvis` HUD (existing) + Brain tab (Phase 7) | HUD stays as the conversational interface. Brain tab adds memory search. |
| Wishlist + Strategy + CashFlow | `/finances` tab below the net worth hero | Preserved as-is, visual restyle later. |
| Drinking + hypertrophy playbook | Coach text (existing) | Lives in `/gym`. |
| Monthly retro | `/review` tab (Phase 5) | Promoted from Home. |
| Streak | `goal_streaks` table | Surfaces in OperatorCard. |
| Sleep + wake_logs | Oura ingestion + scoring | Wake-on-time covered. Sleep data flows to context-builder + snapshot. |
| LogSheet (the + button modal) | TopRail `+` button | Already wired. Provides quick logging for water, mood, drinks, etc. |

## Backend brain layer (Phase 7 — pending)

| Capability | Status |
|---|---|
| `memory_chunks` (pgvector) | NOT YET — Phase 7 migration |
| Embedding pipeline on writes | NOT YET — would embed on long_term_goals, daily_context, journal_entries, business_tasks, business_artifacts |
| `/api/memory/search` | NOT YET |
| `/api/ask` endpoint (memory-augmented) | NOT YET |
| Brain tab in TopRail | NOT YET |
| Web-form capture pipeline (`/api/capture`) | NOT YET — Phase 7. **No Telegram** per Sir's directive. |
| Classifier router (Claude primary + OpenAI fallback) | NOT YET |
| Demo mode | NOT YET — could be Phase 8 if requested |

## Stack as of Phase 2

- Next.js 16 App Router (note: Rowan is on 16, Miles' guide says 15 — checked, our APIs work)
- TypeScript strict
- Tailwind (no oklch tokens yet — design-tokens.ts is the source; could migrate later)
- Supabase Postgres + RLS + Realtime
- Anthropic Claude (Sonnet 4.6 chat, Haiku 4.5 background)
- OpenAI for embedding + Whisper (Phase 7)
- Vercel for hosting + cron

## Migration ledger

Phase 2 added no new tables. All cards read existing tables.

## File hygiene

Deprecated-but-kept files (do not import these from Home anymore):
- `components/home/WelcomeCard.tsx`
- `components/home/TodaysCall.tsx` (lives in `components/health/`)
- `components/home/StreakAlert.tsx`
- `components/home/MonthlyRetroCard.tsx` (will move to /review)
- `components/home/DayBrief.tsx`
- `components/home/TodayWrap.tsx`
- `components/home/WhatMattersCard.tsx`
- `components/home/QuickStatsStrip.tsx`
- `components/layout/TopHeader.tsx` (replaced by TopRail)
- `components/layout/SideNav.tsx` (replaced by TopRail)
- `components/finances/NetWorthSection.tsx` (replaced by NetWorthHero + AssetBreakdown + SnapshotHistory)

These will be deleted in a cleanup pass once V2 visual is fully validated (after Phase 6).
