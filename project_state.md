# Rowan Dashboard — Project State (Source of Truth)

> Last updated: 2026-05-10
> Note: `ARCHITECTURE.md` is an outdated original spec. This file reflects the actual current state.

---

## Core Objectives

A personal performance OS — not a collection of trackers. Every data source (Oura ring, workouts, supplements, goals, mood, faith, journal) feeds a central AI brain (the Overseer) that reasons across all of them. ADHD-optimized: low cognitive load, quick logging, streak defense, priority-ordered UI.

**Primary user:** single user (Colin), deployed as a PWA on iPhone + desktop.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.6 |
| UI | React | 19.2.4 |
| Language | TypeScript | latest |
| Styling | Tailwind CSS | v4 |
| Database | Supabase (PostgreSQL) | ^2.105.4 |
| Auth | Supabase Auth | — |
| Realtime | Supabase Realtime (postgres_changes) | — |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) | ^0.95.1 |
| Charts | Recharts | ^3.8.1 |
| Icons | Lucide React | ^1.14.0 |
| Deployment | Vercel | — |

**AI models in use:**
- Chat (Overseer): `claude-sonnet-4-6` — streaming, 512 tokens max
- Analysis / insights: `claude-haiku-4-5-20251001` — 200 tokens max
- Journal parsing / action plans: `claude-haiku-4-5-20251001` — async, fire-and-forget

**Design system rules (never break these):**
- Background: `zinc-950` / Cards: `zinc-900` with `border-zinc-800`
- Section labels: `text-[10px] uppercase tracking-widest text-zinc-500` prefixed with `—`
- No external CSS libraries (no shadcn, no MUI, no Radix) — custom primitives only
- Glass morphism for overlays: `bg-white/5 backdrop-blur-xl`

---

## Navigation (5 Tabs)

```
[ Home ]  [ Life ]  [ +LOG ]  [ Coach ]  [ Data ]
```

| Tab | Route | Description |
|-----|-------|-------------|
| Home | `/home` | Daily score, goals ticker, quick stats, day ring |
| Life | `/life` | Full goal list, long-term goals, journal |
| **+LOG** | no route — bottom sheet modal | Unified log overlay (9 categories) |
| Coach | `/coach` | Full Overseer chat + insights history |
| Data | `/data?tab=health\|fitness\|finances` | All detailed data views |

The `+` center button is NOT a route. `BottomNav.tsx` holds `useState<boolean>` for `LogSheet` open/close. `LogSheet` renders inside BottomNav's JSX tree so it survives tab navigation.

Old routes redirect: `/main` → `/home`, `/health` → `/data?tab=health`, `/fitness` → `/data?tab=fitness`, `/finances` → `/data?tab=finances`.

---

## Current Architecture

### File Structure (actual current state)

```
rowan-dashboard/
├── app/
│   ├── page.tsx                        # redirects → /home
│   ├── globals.css                     # Tailwind base + radial accent system + animations
│   ├── layout.tsx                      # Root layout, PWA meta
│   │
│   ├── (app)/
│   │   ├── layout.tsx                  # App shell: TopHeader + BottomNav
│   │   ├── home/page.tsx               # Daily score, CheckInCard, GoalTicker, DayRing
│   │   ├── life/page.tsx               # Goals, LongTermGoalsCard, JournalCard
│   │   ├── coach/page.tsx              # OverseerChat + insights strip
│   │   ├── data/page.tsx               # Sub-tab router (health/fitness/finances)
│   │   ├── data/FinancesContent.tsx    # Finances content extracted as client component
│   │   ├── main/page.tsx               # redirect → /home
│   │   ├── health/page.tsx             # redirect → /data?tab=health
│   │   ├── fitness/page.tsx            # redirect → /data?tab=fitness
│   │   ├── finances/page.tsx           # redirect → /data?tab=finances
│   │   └── brand/page.tsx              # placeholder (empty)
│   │
│   └── api/
│       ├── overseer/
│       │   ├── chat/route.ts           # Streaming chat (Sonnet), saves to overseer_messages
│       │   ├── analyze/route.ts        # Proactive insight + TodaysCall (Haiku)
│       │   ├── parse-journal/route.ts  # AI summary for journal entries (Haiku)
│       │   ├── action-plan/route.ts    # 3-step plan for long-term goals (Haiku)
│       │   └── parse-daily-context/route.ts  # Parse morning check-in → reminders (Haiku)
│       ├── oura/
│       │   └── poll/route.ts           # Fetches Oura API, upserts health_logs
│       └── workouts/
│           └── update-exercises/route.ts  # One-time idempotent: classifies 43 exercises by type
│
├── components/
│   ├── layout/
│   │   ├── BottomNav.tsx               # 5-tab nav + LogSheet state + center + button
│   │   ├── LogSheet.tsx                # Bottom sheet modal (9 log categories)
│   │   ├── TopHeader.tsx               # Date + split day header
│   │   └── SectionLabel.tsx            # "— LABEL" reusable header
│   │
│   ├── home/
│   │   ├── CheckInCard.tsx             # Morning check-in textarea → collapses to pill
│   │   ├── ScoreHeadline.tsx           # Daily score + LOCK IN / STEADY / CRUSHING IT
│   │   ├── QuickStatsStrip.tsx         # Horizontal pills: supps, water, mood, gym
│   │   ├── PriorityFocusCard.tsx       # Top 3 goals + "+N more in Life →"
│   │   └── StreakAlert.tsx             # Red warning after 8pm if streak at risk
│   │
│   ├── life/
│   │   ├── LongTermGoalsCard.tsx       # Accordion goals + AI action plans + archive
│   │   └── JournalCard.tsx             # Brain dump textarea + last 5 entries
│   │
│   ├── fitness/
│   │   ├── ProgressiveOverloadCoach.tsx  # Full workout tracking UI with RPE + auto-adjustment + Ready screen
│   │   ├── RecoveryStrainCard.tsx        # Whoop-style recovery dial + strain ring + drivers list
│   │   └── WeeklyVolumeCard.tsx          # 10 muscle groups vs. MEV–MRV targets + freq/wk
│   │
│   ├── data/
│   │   └── SubTabBar.tsx               # health / fitness / finances switcher
│   │
│   ├── health/
│   │   ├── HealthCard.tsx              # Oura stats grid (readiness, sleep, HRV, etc.)
│   │   ├── DayRing.tsx                 # SVG time-of-day ring (sun-cycle palette)
│   │   ├── DailyStack.tsx              # Supplement checklist
│   │   ├── MeditationCard.tsx          # Duration buttons + 7-day bar chart + streak
│   │   ├── MedicationTracker.tsx       # Concerta log button
│   │   ├── VeloTracker.tsx             # Velo counter (capped at 5)
│   │   └── TodaysCall.tsx              # AI health headline (green/yellow/red)
│   │
│   ├── overseer/
│   │   └── OverseerChat.tsx            # Full-height flex chat (refactored from OverseerWidget)
│   │
│   ├── productivity/
│   │   └── GoalTicker.tsx              # Scrollable today's goals
│   │
│   └── ui/
│       ├── Card.tsx                    # zinc-900 wrapper
│       ├── Toggle.tsx                  # Segmented control
│       └── ...                         # other primitives
│
├── hooks/
│   ├── useWorkout.ts       # Exercises, sets, RPE, weekly volume, coaching verdict
│   ├── useHealth.ts        # Oura data + auto-poll on mount if !is_final
│   ├── useGoals.ts         # Daily goals, streak, push-to-tomorrow
│   ├── useStack.ts         # Supplement stack + adherence
│   ├── useLog.ts           # Umbrella: water, meditation, alcohol, faith, mood, weight
│   ├── useDailyContext.ts  # Morning check-in state
│   ├── useJournal.ts       # Journal entries + long-term goals
│   ├── useOverseer.ts      # Chat state, streaming, message history
│   ├── useOverseerInsights.ts  # Last 5 insights + dismiss
│   ├── useMeditation.ts    # Meditation logs + streak
│   ├── useMedications.ts   # Concerta/Velo log state
│   └── useFinances.ts      # Subscriptions, budget, orders
│
├── lib/
│   ├── ai/
│   │   ├── context-builder.ts  # Builds full JSON context snapshot for AI (20 parallel queries, includes recovery + strain)
│   │   └── prompts.ts          # buildSystemPrompt, buildAnalysisPrompt, buildTodaysCallPrompt
│   ├── fitness/
│   │   └── recovery.ts         # computeRecoveryScore, computeSessionStrain, muscleFatigue, adjustForRecovery — pure
│   ├── scoring.ts              # computeDailyScore() — pure function, zero API cost
│   └── supabase/
│       ├── client.ts           # createClient() for client components
│       └── server.ts           # createClient() + createServiceClient() for server/API
│
└── supabase/
    └── migrations/
        ├── 0001_initial_schema.sql       # Core tables
        ├── 0002_redesign_tables.sql      # 8 new tables (water, faith, mood, journal, etc.)
        ├── 0003_fitness_intelligence.sql # exercise_type, muscle_targets, rpe columns
        └── 0004_oura_expansion.sql       # stress, resilience, vo2_max, oura_workouts columns
```

---

## Database Schema (current — all 3 migrations applied)

### Core tables (0001)
- `profiles` — user settings
- `health_logs` — Oura data (readiness, sleep, HRV, RHR, SpO2, sleep stages, `todays_call_body`, `todays_call_severity`, `is_final`, `raw_oura_json`)
- `supplement_stack` — user's supplement list (id, name, dose, timing, is_active)
- `supplement_logs` — daily check-ins (supplement_id, log_date)
- `medication_logs` — Concerta + Velo entries (medication_type, taken_at, log_date)
- `goals` — daily tasks (title, goal_date, is_complete, priority, pushed_from)
- `goal_streaks` — current_streak, longest_streak
- `gym_locations` — user's gyms
- `exercises` — exercise library (name, split_day, gym_id, muscle_group)
- `workout_sets` — every set (weight_kg, reps, est_1rm, log_date, logged_at)
- `meditation_logs` — duration_min, log_date
- `overseer_messages` — chat history (role, content)
- `overseer_insights` — proactive AI flags (insight, severity, dismissed_at)
- `subscriptions`, `budget_items`, `incoming_orders` — finances

### Redesign tables (0002)
- `daily_context` — morning check-in text (UNIQUE user_id, log_date)
- `water_logs` — glasses per day (UNIQUE user_id, log_date)
- `alcohol_logs` — drink_type, drink_count, logged_at
- `faith_logs` — prayed, bible_min, church_attended (UNIQUE user_id, log_date)
- `mood_logs` — score 1–5
- `weight_logs` — weight_kg
- `journal_entries` — content, ai_summary
- `long_term_goals` — title, category, target_date, ai_action_plan, is_active

### Fitness intelligence columns (0003)
- `exercises.exercise_type` — "Compound" | "Secondary" | "Isolation"
- `exercises.muscle_targets` — TEXT[] e.g. ["Chest", "Triceps"]
- `workout_sets.rpe` — INT 6–10 (Rate of Perceived Exertion)
- `profiles.goal_weight_kg`, `profiles.training_goal`

### Oura expansion columns (0004)
- `health_logs.stress_high_sec`, `recovery_high_sec`, `stress_day_summary` — daily_stress endpoint
- `health_logs.resilience_level` — Oura's own recovery rating (limited/adequate/solid/strong/exceptional)
- `health_logs.vo2_max` — daily cardiovascular fitness
- `health_logs.oura_workouts` — JSONB array of Oura-detected workouts (last 7 days)
- `health_logs.spo2_pct` and `skin_temp_delta` — now populated (existed before but unused)

---

## Key Logic & Rules

### Daily Score (`lib/scoring.ts`)
Pure function, zero API cost. Runs client-side on Home page.
- Goals: 30pts | Readiness: 25pts | Workout done: 20pts | Supplements: 15pts | Checked in: 10pts
- < 34 → red / "LOCK IN" | 34–66 → amber / "STEADY" | ≥ 67 → emerald / "CRUSHING IT"
- Score sets `document.body.dataset.score` → triggers CSS radial gradient accent

### Overseer Context (`lib/ai/context-builder.ts`)
Runs before every AI call (chat + analyze). 19 parallel Supabase queries. Passes:
- Today's snapshot: goals, supplements, medications, workouts, health, mood, faith, water, daily plan
- **7-day trends**: HRV direction + declining streak, readiness direction, sleep avg, mood avg
- **14-day correlations**: per-supplement vs. deep sleep delta (if ≥15min delta + ≥2 data points → plain English fact)
- **Goal patterns**: 7-day win rate, list of goals with <50% completion this week

### Hypertrophy Coach (`hooks/useWorkout.ts` + `lib/fitness/recovery.ts`)
Double progression model:
- Rep ranges by type: Compound 5–10, Secondary 8–12, Isolation 12–20
- Hit top of range → add weight (2.5kg compound / 1.25kg isolation)
- RPE-aware: stalling + RPE ≥9 → deload to 80%; stalling + RPE ≤7 → "push harder"
- Weekly volume targets (MEV–MRV) for 10 muscle groups, frequency tracking

**Whoop-style recovery + auto-adjustment (RP-framework grounded):**
- Recovery composite = 50% Oura readiness + 30% HRV deviation from 7d baseline + 20% sleep score (±5 from Oura resilience level)
- Bands: exceptional (≥85), primed (≥70), adequate (≥55), compromised (≥40), low (<40)
- Per-muscle fatigue: fresh (>72h), recovering (48–72h), fatigued (24–48h), deeply-fatigued (<24h + RPE 9+ + ≥6 hard sets)
- Adjustment matrix (cuts VOLUME first, then RPE cap, then weight at extreme low recovery)
- "Force PR Mode" toggle preserves user autonomy
- Session strain (0–21, log scale) computed from today's sets × RPE multipliers

### Oura Auto-Sync (`hooks/useHealth.ts`)
On mount: loads today's health_log. If `!data || !data.is_final` → fires `POST /api/oura/poll` silently. No manual trigger needed. Uses PAT stored in `OURA_PAT` env var.

---

## Progress Log

### Fully functional ✓
- 5-tab navigation with LogSheet overlay
- Home page: daily score, check-in card, goal ticker, quick stats, day ring, streak alert
- Life page: daily goals, long-term goals with AI action plans, journal with AI summaries
- Coach page: full-height Overseer chat + insights history + context transparency
- Data page: health/fitness/finances sub-tabs
- Health tab: Oura stats, meditation tracker, supplement stack, Concerta/Velo trackers
- Fitness tab: pre-workout Ready screen, RecoveryStrainCard, ProgressiveOverloadCoach with auto-adjusted prescriptions + Force PR Mode, WeeklyVolumeCard with frequency
- Overseer: trend-aware (7-day HRV/readiness/sleep/mood trends), supplement correlations, goal patterns, recovery + strain composite
- Oura ring: auto-syncs on page load via PAT — fetches readiness, sleep, activity, **spo2, stress, resilience, vo2_max, workouts**
- Whoop-style recovery scoring: 50% readiness + 30% HRV deviation + 20% sleep, banded into exceptional/primed/adequate/compromised/low
- Per-muscle local fatigue tracking — hours since last hit, hard sets last 48h, RPE memory
- Auto-adjusted lift prescriptions: weight × reps × sets × RPE cap modified based on recovery + muscle status (evidence-based, RP-style)
- Deployed on Vercel + accessible on iPhone as PWA

### Pending (needs user action)
- Run `0002_redesign_tables.sql` in Supabase SQL Editor (if not yet applied)
- Run `0003_fitness_intelligence.sql` in Supabase SQL Editor (if not yet applied)
- Run `0004_oura_expansion.sql` in Supabase SQL Editor — adds stress, resilience, vo2_max, workouts columns
- Call `POST /api/workouts/update-exercises` once to classify all 43 exercises by type

### Known issues
- `ARCHITECTURE.md` in root is outdated — ignore it, use this file

---

## Constraints & Agreed Rules

- **No external component libraries** — all UI is custom (no shadcn, Radix, MUI)
- **No comments in code** unless the WHY is non-obvious
- **Supabase Realtime** uses unique channel refs (`useRef(\`prefix-${Math.random()}\`)`) to prevent collision
- **6am day boundary** — before 6am, "today" = yesterday's date (used in all hooks)
- **AI costs** — Haiku for all async/background tasks; Sonnet only for interactive chat
- **`computeDailyScore()`** is pure TypeScript, never calls AI
- **LogSheet** is not a route — lives in BottomNav JSX to survive tab navigation
- **Vercel deployment** — all 6 env vars must be set in Vercel dashboard (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OURA_PAT`, `WORKOUT_API_KEY`)
