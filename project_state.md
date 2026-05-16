# Rowan Dashboard — Project State (Source of Truth)

> Last updated: 2026-05-16
> Note: `ARCHITECTURE.md` is an outdated original spec. This file reflects the actual current state.
>
> **2026-05-16 — Apple-level design pass shipped** (Phases 1-3):
> Phase 1: extended `lib/design-tokens.ts` (RADIUS, ICON, DURATION, EASE, TAP, BORDER.hair, TYPE.title/hero); upgraded `Card` + `FormInput` to use tokens; added `Button` primitive (4 variants × 2 sizes, 44pt default).
> Phase 2: removed "Sir" from all user-visible UI strings (persona stays in `lib/jarvis/prompts.ts`); copy is now second-person / imperative.
> Phase 3: text-only and icon-only buttons (Skip, dismiss ✕, Clear, X close) gained `-m-2 p-2` to extend tap zones past the 44pt Apple HIG floor without changing visual size.
>
> **2026-05-16 — Per-agent scheduling (0031):**
> Business agents can now run autonomously on a daily / weekly / monthly schedule. New columns on `business_agents`: schedule_kind, schedule_hour, schedule_dow, schedule_dom, next_run_at. Vercel Cron at `*/5 * * * *` hits `/api/cron/business-agents` which queries due agents, builds the same deploy prompt the manual Run button does (via the shared lib/businesses/agent-prompts helper), inserts a `jarvis_cc_dispatches` row, and bumps next_run_at. Bridge daemon on Sir's Mac picks up dispatches the next time it's online — scheduled runs never get dropped if Mac is off. BusinessAgents UI gained a clock icon per agent that opens an inline SchedulePicker (kind / hour / day-of-week / day-of-month). Schedule preview shows inline ("Mondays at 9am") next to "last run". CRON_SECRET env var required for the cron route's auth. Context-builder surfaces `agents[].schedule` so Jarvis knows what's auto-running.
>
> **2026-05-16 — Beauty pass shipped:**
> Type rhythm in lib/design-tokens.ts gains a real scale: display (text-6xl black, tight tracking) / headline (xl bold) / subtitle (sm medium) / caption (xs zinc-500) / micro (9px bold tracked-wide). Existing tokens (label, body, title, metric, hero) keep working but now have intentional tracking + weight refinements. New SHADOW tokens (hero / primary / inline) drive Card depth language. New SPRING tokens (smooth / snappy / bounce) for moments when EASE isn't enough. Card primitive accepts a `variant` prop — hero (stronger blur 32px + lit inner highlight + deeper shadow) / primary (current default) / inline (minimal border-only). TodayWrap and BusinessHero promoted to hero variant; both moved to TYPE.display for their headline number. BusinessDetail MRR also uses display type. CollapsibleSection rewritten with the CSS Grid template-rows 0fr↔1fr trick so expand/collapse smoothly animates the height instead of snapping. Atmosphere bumped — added a third radial wash (subtle blue at bottom + faint center white), film grain opacity nudged from 0.014 → 0.018. Per the constraints: no new dependencies, no schema changes, no behavior changes — pure visual upgrade through tokens + the Card primitive.
>
> **2026-05-16 — Businesses control-panel v1 shipped (0030):**
> BusinessDetail rewritten from a vertical form into a real control panel. Layout: hero (name + stage chip + MRR + sparkline + MoM%) → log-revenue (collapsed into a button) → Tasks (main work surface) → Agents (with artifact previews) → Activity feed → Stats (collapsed) → Notes (collapsed) → Archive. New `business_tasks` table replaces the single `next_action` text field with a real checklist (priority cycle on tap, optional due dates, done section collapses). Migration auto-imports existing `next_action` values into first task. Activity feed is derived from existing tables (revenue + agent runs + artifacts + task completions) — no new schema. MRRSparkline pulls the revenue log and renders inline next to the hero number. BusinessCard gained a "stale" amber chip for businesses with no activity in 7+ days, and shows the top open task as "Next:" instead of the legacy field. CollapsibleSection primitive added for Stats / Notes. Jarvis context gains `context.businesses.items[].openTasks[]` so he can answer "what's left on X" by reading directly.
>
> **2026-05-16 — Agent artifacts wired back to businesses (0029):**
> Each `jarvis_artifact` can now be tagged with `business_id` + `business_agent_id`. BusinessAgents UI surfaces the latest deliverable per agent inline (collapsed: name + first-line preview + relative time; expanded: full content). When the BusinessAgents UI dispatches a run, the deploy prompt explicitly tells Jarvis to pass these IDs through to `write_artifact` so outputs flow back automatically. `useBusinessAgentArtifacts` realtime-subscribes to artifact inserts so new deliverables appear without refresh. Context-builder adds `latestArtifact: { id, name, createdAt }` to each agent in `context.businesses.items[].agents[]` so Jarvis can reference outputs by name without a separate read_artifact call.
>
> **2026-05-16 — Per-business agent workforce shipped (0028):**
> Each business in the portfolio now has its own agent workforce. New `business_agents` table links a business_id to one or more agent roles (agent_name maps to a `.claude/agents/<name>.md` definition). BusinessDetail sheet gained an Agents section: list of assigned agents, Run button (auto-injects business context — name/status/MRR/next action — into the deploy prompt), define-new flow (creates the definition + dispatches first run via Jarvis). JarvisHUD now accepts an `initialMessage` prop and autosends; BottomNav listens for a global `jarvis:open` CustomEvent so any surface can dispatch into Jarvis with a prefilled prompt. Context-builder surfaces `businesses[].agents[]` (name, role, purpose, lastRunAt) so Jarvis can answer "what's working on SaaS v2?" without being told.
>
> **2026-05-16 — Businesses portfolio hub shipped (0027):**
> Replaced the old "/businesses is a goals list filtered by bucket" pattern with a real business-entity portfolio. New tables `businesses` (status / category / MRR / customers / next_action / notes) and `business_revenue_log` (date-stamped revenue entries for MoM growth). `/businesses` page now: BusinessHero (total MRR + top earner), per-business cards sorted by status, AddBusinessFlow inline, BusinessDetail sheet for the drill-in (status, MRR + revenue log + history, customers, next action, notes, archive). Per AGENTS.md 5-place rule: wired into `lib/ai/context-builder.ts` as `context.businesses` (count + totalMRR + items[] with momPct), into `lib/ai/snapshot-builder.ts` as the new `business_mrr_total` snapshot column (lets correlation engine spot focus_min ↔ MRR etc.), into `app/api/jarvis/correlations/route.ts` LABEL map as "total business MRR", and documented in `lib/jarvis/prompts.ts` under `context.businesses`. Business long-term goals still live below the portfolio on the same page.

---

## Core Objectives

A personal performance OS — not a collection of trackers. Every data source (Oura ring, workouts, supplements, goals, mood, faith, journal) feeds a central AI brain (Jarvis) that reasons across all of them. ADHD-optimized: low cognitive load, quick logging, streak defense, priority-ordered UI.

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
- Chat (Jarvis): `claude-sonnet-4-6` — streaming, 512 tokens max
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
[ Home ]  [ Schedule ]  [ Jarvis ]  [ Gym ]  [ Goals ]
```

| Tab | Route | Description |
|-----|-------|-------------|
| Home | `/home` | Daily score, goals ticker, briefing, weekly review, day ring |
| Schedule | `/schedule` | **Just the schedule.** Vertical timeline of today's routine items: time gutter on the left, colored category circles in the middle, checkboxes on the right. Items filtered to today's day-of-week (per `days_of_week` column). Inline **Add** button opens the sheet (name + bucket + optional specific time + duration + category + recurrence + optional goal link). Jarvis auto-classifies free-form names via `/api/jarvis/classify-item`. Per-item streak (🔥) and 7-day compliance ratio surface next to each row. Biometrics / protein / goals / journal moved off this tab on purpose — they live where they belong (Home / Gym / Goals). `/lifemax` redirects here. |
| **Jarvis (center)** | full-screen overlay | The system operator. Pulsing orb HUD with voice-to-voice chat, ambient telemetry, tool execution. Replaces +LOG button. |
| Gym | `/gym` | Hypertrophy coach + recovery + strain + weekly volume |
| Goals | `/goals` | Two pill sub-tabs (Life / Businesses). One widget per long-term goal: title + category chip + progress bar (avg `ratio7d` across linked routine items) + target-date countdown when collapsed. Expanded: editable `current_state` + `next_steps`, linked routine items with adherence pills, business `metrics` JSON editor, "Jarvis's take" (Haiku 4.5, 1-hour cooldown, lazy weekly auto-refresh on page open), original `ai_action_plan`, move-between-buckets + archive. `/business` redirects here with `?tab=business`. |

**Logging architecture principle:** the interaction *shape* drives where it lives, not whether it's daily.
- **Checklist** (recurring fixed list — supplements, meds, injections, skincare) → tapped inline on LifeMax (you need to see what's left)
- **Counter / single-event log** (water, mood, weight, alcohol, brain dump, protein, etc) → +LOG popup (one surface for "I want to record something")
- **Brain dump is ONE entry** in +LOG with a Personal/Business/Other tag. LifeMax shows personal-tagged entries; Business shows business-tagged. No duplicate brain dump UI.

The `+` center button is NOT a route. `BottomNav.tsx` holds `useState<boolean>` for `LogSheet` open/close. `LogSheet` renders inside BottomNav's JSX tree so it survives tab navigation.

Old routes redirect:
- `/main` → `/home`
- `/life` → `/lifemax`
- `/coach` → `/home` (Jarvis is now a floating bubble on Home)
- `/health`, `/fitness`, `/finances` → respective new tabs
- `/data?tab=health` → `/lifemax`, `/data?tab=fitness` → `/gym`, `/data?tab=finances` → `/business`

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
│   │   ├── coach/page.tsx              # JarvisHUD + insights strip
│   │   ├── data/page.tsx               # Sub-tab router (health/fitness/finances)
│   │   ├── data/FinancesContent.tsx    # Finances content extracted as client component
│   │   ├── main/page.tsx               # redirect → /home
│   │   ├── health/page.tsx             # redirect → /data?tab=health
│   │   ├── fitness/page.tsx            # redirect → /data?tab=fitness
│   │   ├── finances/page.tsx           # redirect → /data?tab=finances
│   │   └── brand/page.tsx              # placeholder (empty)
│   │
│   └── api/
│       ├── jarvis/
│       │   ├── chat/route.ts           # Streaming chat with prompt caching + native tool round-trip
│       │   ├── tts/route.ts            # ElevenLabs proxy
│       │   ├── briefing/route.ts       # Morning briefing (Haiku)
│       │   ├── weekly-review/route.ts  # Sunday week-in-review letter (Sonnet)
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
│   │   ├── ProgressiveOverloadCoach.tsx  # Full workout tracking UI + per-set intensity protocol + warmups + auto-adjustment + Ready screen
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
│   ├── productivity/
│   │   └── GoalTicker.tsx              # Scrollable today's goals
│   │
│   └── ui/
│       ├── Card.tsx                    # zinc-900 wrapper
│       ├── Toggle.tsx                  # Segmented control
│       └── ...                         # other primitives
│
├── hooks/
│   ├── useWorkout.ts       # Exercises, sets, weekly volume, coaching verdict, per-set intensity protocol, warmups
│   ├── useHealth.ts        # Oura data + auto-poll on mount if !is_final
│   ├── useGoals.ts         # Daily goals, streak, push-to-tomorrow
│   ├── useStack.ts         # Supplement stack + adherence
│   ├── useLog.ts           # Umbrella: water, meditation, alcohol, faith, mood, weight
│   ├── useDailyContext.ts  # Morning check-in state
│   ├── useJournal.ts       # Journal entries + long-term goals
│   ├── (removed).ts      # Chat state, streaming, message history
│   ├── (removed).ts  # Last 5 insights + dismiss
│   ├── useMeditation.ts    # Meditation logs + streak
│   ├── useMedications.ts   # Concerta/Velo log state
│   └── useFinances.ts      # Subscriptions, budget, orders
│
├── lib/
│   ├── ai/
│   │   ├── context-builder.ts  # Builds full JSON context for AI (22 parallel queries, recovery + strain + perf correlations)
│   │   ├── snapshot-builder.ts # 21-day wide-format CSV — auto-discovery layer for Jarvis
│   │   └── prompts.ts          # buildSystemPrompt, buildAnalysisPrompt, buildTodaysCallPrompt
│   ├── fitness/
│   │   └── recovery.ts         # computeRecoveryScore, computeSessionStrain, muscleFatigue, adjustForRecovery — pure
│   ├── scoring.ts              # computeDailyScore() — pure function, zero API cost
│   └── supabase/
│       ├── client.ts           # createClient() for client components
│       └── server.ts           # createClient() + createServiceClient() for server/API
│
├── supabase/
│   └── migrations/
│       ├── 0001_initial_schema.sql       # Core tables
│       ├── 0002_redesign_tables.sql      # 8 new tables (water, faith, mood, journal, etc.)
│       ├── 0003_fitness_intelligence.sql # exercise_type, muscle_targets, rpe columns
│       ├── 0004_oura_expansion.sql       # stress, resilience, vo2_max, oura_workouts columns
│       ├── 0005_protein_logger.sql       # protein_logs table (manual + photo + barcode)
│       ├── 0006_coach_extensions.sql     # morning_briefings + weekly_reviews + goal_templates
│       ├── 0007_lifemax_business.sql     # category columns on supplement_stack + journal_entries
│       ├── 0008_jarvis.sql                # jarvis_facts + jarvis_workers + jarvis_worker_runs + jarvis_conversations
│       ├── 0009_jarvis_artifacts.sql      # jarvis_artifacts — worker outputs (blog posts, plans, reports)
│       └── 0014_schedule_recurrence.sql  # days_of_week INT[] for per-item recurrence
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
- `jarvis_messages` — chat history (role, content)
- `jarvis_insights` — proactive AI flags (insight, severity, dismissed_at)
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

### Jarvis Context (`lib/ai/context-builder.ts`)
Runs before every AI call (chat + analyze). 22 parallel Supabase queries. Passes:
- Today's snapshot: goals, supplements, medications, workouts, health, mood, faith, water, daily plan
- **7-day trends**: HRV direction + declining streak, readiness direction, sleep avg, mood avg
- **14-day correlations**: per-supplement vs. deep sleep delta (if ≥15min delta + ≥2 data points → plain English fact)
- **Goal patterns**: 7-day win rate, list of goals with <50% completion this week
- **Recovery**: composite score (50% readiness + 30% HRV dev + 20% sleep), band, drivers, today's strain, hours since workout
- **Performance correlations (21-day)**: readiness→volume %, sleep→reps gap, per-supplement→volume %, Concerta→volume %, PRs this week by exercise, stalled exercises by name
- **Autonomous discovery layer (`lib/ai/snapshot-builder.ts`)**: 21-day wide-format CSV table — one row per date, one column per metric (health, supplements, meds, training, lifestyle, faith, goals, per-supplement booleans). Jarvis scans for patterns NOT covered by pre-computed correlations. New metrics added to the app automatically become columns. **Used by both chat AND proactive analyze flow.**
- **Anti-repeat memory**: context.recentInsights[] contains last 5 surfaced insights with hoursAgo. Analyze prompt explicitly avoids repeating the same insight within 24h — finds new angles or returns null.

### Proactive Surfacing
- `components/layout/ProactiveCheck.tsx` lives in the (app) shell layout. On page mount, if last insight is > 90 min old, hits `/api/jarvis/analyze`.
- Analyze runs Haiku with `buildAnalysisPrompt` — instructed to surface ONE insight that's either actionable OR a noteworthy pattern from the daily snapshot.
- Inserts into `jarvis_insights` table → surfaces as dismissible banner at top of every app page AND in Coach insights strip.
- Anti-repeat: AI sees its recent 5 insights and won't repeat them.

### Hypertrophy Coach (`hooks/useWorkout.ts` + `lib/fitness/recovery.ts`)
Double progression model:
- Rep ranges by type: Compound 5–10, Secondary 8–12, Isolation 12–20
- Hit top of range → add weight (2.5kg compound / 1.25kg isolation)
- Per-set intensity protocol per exercise type + status: which sets are RIR-capped vs to failure vs extended past failure (lengthened partials / drop-sets / rest-pause / myo-reps). Recovery band gates intensity — compromised/low strips the extension techniques and floors RIR at 2.
- Warmup sets scaled to working weight + exercise type: compounds get a 3-step ramp, secondaries 2, isolations 0–1.
- RPE input is REMOVED from the coach — the per-set protocol replaces it. `workout_sets.rpe` column kept nullable (no migration), always written null.
- Weekly volume targets (MEV–MRV) for 10 muscle groups, frequency tracking

**Whoop-style recovery + auto-adjustment (RP-framework grounded):**
- Recovery composite = 50% Oura readiness + 30% HRV deviation from 7d baseline + 20% sleep score (±5 from Oura resilience level)
- Bands: exceptional (≥85), primed (≥70), adequate (≥55), compromised (≥40), low (<40)
- Per-muscle fatigue: fresh (>72h), recovering (48–72h), fatigued (24–48h), deeply-fatigued (<24h + ≥6 hard sets)
- Adjustment matrix (cuts VOLUME first, then strips intensity techniques, then weight at extreme low recovery)
- Chronic protein deficit (3+ of last 7 days under target) surfaces as a recovery DRIVER (not in score) and hedges the prescription
- "Force PR Mode" toggle preserves user autonomy
- Session strain (0–21, log scale) computed from today's sets

### Oura Auto-Sync (`hooks/useHealth.ts`)
On mount: loads today's health_log. If `!data || !data.is_final` → fires `POST /api/oura/poll` silently. No manual trigger needed. Uses PAT stored in `OURA_PAT` env var.

---

## Progress Log

### Fully functional ✓
- 5-tab navigation with LogSheet overlay
- Home page: daily score, check-in card, goal ticker, quick stats, day ring, streak alert
- Life page: daily goals, long-term goals with AI action plans, journal with AI summaries
- Coach page: full-height Jarvis chat + insights history + context transparency
- Data page: health/fitness/finances sub-tabs
- Health tab: Oura stats, meditation tracker, supplement stack, Concerta/Velo trackers
- Fitness tab: pre-workout Ready screen, RecoveryStrainCard, ProgressiveOverloadCoach with auto-adjusted prescriptions + Force PR Mode, WeeklyVolumeCard with frequency
- Jarvis: trend-aware (7-day HRV/readiness/sleep/mood trends), supplement correlations, goal patterns, recovery + strain composite
- Oura ring: auto-syncs on page load via PAT — fetches readiness, sleep, activity, **spo2, stress, resilience, vo2_max, workouts**
- Whoop-style recovery scoring: 50% readiness + 30% HRV deviation + 20% sleep, banded into exceptional/primed/adequate/compromised/low
- Protein logger (manual + photo + barcode) with AI vision scoring (0-100 for lean aesthetic muscle suitability); only protein persisted, score is metadata; daily target = weight × 2.0g/kg
- **Weight tracker + recomp read** on Gym tab — quick log + 30d sparkline + verdict: combines 21d weight slope (linear regression, kg/wk), avg %change in top est_1rm per exercise, and 21d protein adherence to call lean-bulk / fat-gain / recomp / clean-cut / lossy-cut / regression / maintain. Verdict flows into `context.composition` so Jarvis chat sees the same read as the dashboard.
- **Mesocycle / deload programming** — `mesocycles` table, one active at a time per user. Default 5-week block: weeks 1-4 accumulate (per-muscle weekly volume ramps linearly MEV→MRV), week 5 forces deload (half volume, RIR 3, no failure, no extension techniques — `CoachStatus = "DELOAD"`). Per-muscle `muscle_priorities` JSONB lets lagging muscles be marked `specialize` (hold at MRV every week) or `maintenance` (stay at MEV). `WeeklyVolumeCard` shows the dynamic week-target tick, not just the static MEV-MRV envelope. Meso state flows into `context.mesocycle` so Jarvis knows whether to push or hold.
- Per-muscle local fatigue tracking — hours since last hit, hard sets last 48h
- Auto-adjusted lift prescriptions: weight × reps × sets + per-set RIR/failure/extension protocol modified based on recovery + muscle status (evidence-based, RP-style)
- **Settings page** at /settings (gear icon in TopHeader) — edit profile, supplements, exercises, gyms, recurring goal templates, sign out
- **Welcome card** auto-appears on Home when supplements + exercises + weight are all empty
- **Morning briefing** — Haiku-generated 3-sentence brief, fires once per day on app open, stored in `morning_briefings`
- **Weekly review** — Sonnet 4.6-generated letter, auto-fires Sunday after 8am, stored in `weekly_reviews`, shown as expandable card on Home
- **Conversational goal completion** — Jarvis chat now executes tool calls (log water, complete goal, log supplement, log protein, etc.) via Anthropic tool use. Tool results stream as ✓ chips above the assistant's text response.
- **Goal templates** — recurring goals auto-populate daily goal list each morning via `goal_templates` table
- 4-digit passcode auth flow (proxy.ts gates non-public paths)
- Deployed on Vercel + accessible on iPhone as PWA (manifest, apple touch icon SVG, status bar styling)

### Jarvis (system operator)
Full-screen voice-to-voice assistant. Modeled after Tony Stark's Jarvis. Lives at the center of the bottom nav — tap the glowing orb to open the HUD.

**Architecture:**
- `app/(app)/jarvis/JarvisHUD.tsx` — Iron Man tactical HUD aesthetic. Cyan monospace overlay with: top status bar (J.A.R.V.I.S. title, ONLINE/SECURE/ENCRYPTED/AUTO-LVL9 pills, ms-precision timestamp, session id), 12-col grid body — SYSTEM VITALS + TELEMETRY panels (left), Orb + live caption + tool chips (center), PROXIMITY radar + AUDIO I/O bar meter + DIAGNOSTICS (right), bottom command-line input with ▸ prompt. Background grid pattern. Tap-to-toggle mic (single click starts/stops continuous listening).
- `app/(app)/jarvis/Orb.tsx` — SVG-based multi-ring orb with 180-particle nebula core. State-driven cyan hues (idle 200, listening 185, thinking 220, speaking 195). Layered rings: outermost with 36 cardinal tick marks, dashed counter-rotating mid-ring with 3 accent arcs, inner solid ring, innermost dashed decorative — each spinning at different speeds per state. Real audio levels driven by Web Audio API `AnalyserNode` via `getUserMedia` while listening.
- `lib/jarvis/voice.ts` — `webkitSpeechRecognition` STT + **ElevenLabs TTS** (cinematic British "Daniel" voice via `/api/jarvis/tts` proxy, `eleven_turbo_v2_5` model, sentence-buffered streaming speaker, sequential audio queue, browser `speechSynthesis` fallback if API down). Requires `ELEVENLABS_API_KEY` env var.
- `app/api/jarvis/tts/route.ts` — server proxy to ElevenLabs (keeps API key off the client). Voice ID `onwK4e9ZLuTAKqWW03F9` (Daniel).
- `lib/jarvis/prompts.ts` — Jarvis persona prompt (formal, dry, addresses user as "Sir")
- `lib/jarvis/memory.ts` — read/write `jarvis_facts` with confidence reinforcement
- `lib/jarvis/cc-bridge.ts` — typed helpers for dispatching, listing, monitoring, stopping, and defining Claude Code agents via the Tauri shell

**Memory:** `jarvis_facts` table. Jarvis writes facts via `remember_fact` tool, reads them on every conversation. Duplicates reinforce confidence rather than create new rows.

**Agent runtime (Claude Code `claude agents`):** the autonomous business agent fleet is hosted by Claude Code's native agent supervisor — NOT a custom in-house runner. Each agent is a markdown file at `<repo>/.claude/agents/<name>.md` with frontmatter (`name`, `description`, `tools`, `model`, `permissionMode`, `isolation`) and a system prompt body. CC picks them up automatically when run from the repo. Sessions are dispatched with `claude --bg [--agent <name>] "<prompt>"` and managed via `claude agents` (terminal UI), `claude logs <id>`, `claude stop <id>`. Sessions survive terminal close but stop on machine sleep — for always-on, use [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web). Framework docs live at [.claude/agents/README.md](.claude/agents/README.md); a starter template sits at [.claude/agents/_TEMPLATE.md](.claude/agents/_TEMPLATE.md).

**Tools Jarvis has** (`lib/ai/tools.ts`):
- **Logging**: log_water, log_protein, log_meditation, log_mood, log_weight, log_alcohol, log_concerta, log_supplement, complete_goal, mark_prayed, mark_bible, mark_church
- **Memory**: remember_fact, recall_facts
- **Capabilities (server-side)**:
  - `fetch_url(url, method?, headers?, body?)` — generic HTTP, 80KB cap, SSRF-blocked for private IPs
  - `web_search(query, max_results?)` — Tavily API (free tier; needs TAVILY_API_KEY env var)
  - `write_artifact(name, content, type?)` — persists substantial outputs to `jarvis_artifacts`
  - `list_artifacts(limit?)` — recent artifacts
  - `read_artifact(id_or_name)` — retrieve full content
- **Client interaction**: open_url (returns __OPEN_URL__ marker → SSE openUrl → window.open in browser)

**Native tools (Tauri-only)** — when Jarvis chat runs inside the desktop shell (`isTauri()` returns true), `NATIVE_TOOLS` are appended to its tool list:
- OS surface: `take_screenshot`, `mouse_click`, `keyboard_type`, `keyboard_key`, `run_shell`, `read_file`, `write_file`, `list_directory`
- CC agent runtime: `cc_run_agent`, `cc_list_agents`, `cc_agent_logs`, `cc_stop_agent`, `cc_define_agent`, `cc_list_defined_agents`, `cc_read_agent`

The server never executes native tools — when Claude calls one, the chat route emits a `pendingNative` SSE event with the full assistant turn + tool_use blocks, then closes the stream. The client (`JarvisHUD`) executes each native tool through the Tauri bridge, builds tool_result content (screenshots come back as `image` blocks so Claude actually sees the screen), and POSTs back with `resumeFrom: { messages, toolResults }`. The server's `resumeFrom` path skips the initial Claude call and continues the conversation with the appended tool_results. The round-trip loops up to 6 times per user message. In a regular browser, native tools are stripped from the toolset entirely.

The CC agent native tools work in TWO modes:
- **Inside the Tauri desktop app** — shell out to the `claude` CLI directly via the Tauri shell plugin (fast, no DB round-trip).
- **Inside the regular browser PWA** — write a row to the `jarvis_cc_dispatches` Supabase table; the local **bridge daemon** (`scripts/jarvis-bridge.ts`, started with `npm run bridge`) subscribes via Realtime, executes the matching `claude` command on the user's Mac, and writes the result back. Web client awaits the UPDATE via filtered Realtime subscription on its own row id. 30-second timeout if the bridge isn't running.

Mapping (same for both modes):
- `cc_run_agent` → `claude --bg [--agent <name>] "<prompt>"`
- `cc_list_agents` → `claude agents --json` (best-effort parse)
- `cc_agent_logs` → `claude logs <id>`
- `cc_stop_agent` → `claude stop <id>`
- `cc_define_agent` → writes a markdown file directly to `.claude/agents/<name>.md`
- `cc_list_defined_agents` / `cc_read_agent` → enumerate or read those markdown files

The OS native tools (screenshot, mouse, keyboard, shell, fs) still **require Tauri** — no browser fallback. The chat route splits these into `OS_NATIVE_TOOLS` (Tauri-only) and `CC_NATIVE_TOOLS` (always available) so the toolset Claude sees matches what actually works in the current environment.

CC sessions inherit the FULL Claude Code tool surface — Bash, Read, Edit, WebFetch, WebSearch, MCP servers — so an agent can `pip install playwright`, run a real browser, hit APIs, edit files, open PRs, etc. The tool allowlist per agent is controlled by the `tools:` frontmatter in its markdown file.

**When does Jarvis dispatch a CC agent vs handle it directly?** Single-turn answers, personal logging, opening URLs — handle directly. "Research X / build Y / monitor Z / draft N posts / scrape / deploy" — dispatch a CC agent. The `cc_run_agent` description in `tools.ts` enforces this distinction in Claude's tool description.

**`open_url` mechanic:** server-side returns a special `__OPEN_URL__<url>` marker → SSE `openUrl` event → client `window.open()`. The only client-side "computer interaction" a PWA can do.

**Voice quality:** ElevenLabs "Daniel" (British, authoritative news-anchor delivery — closest pre-made voice to Paul Bettany's Jarvis). Model `eleven_turbo_v2_5` for low latency. Browser `speechSynthesis` is the fallback if the API errors so the assistant still talks.

### Future (V2+)
- pgvector embeddings memory (upgrade from ILIKE search)
- First agent definitions in `.claude/agents/` (e.g. Upwork auto-proposer, content factory, lead scraper) — framework is in place, agent design is yours
- Always-on cloud execution via [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web) for agents that need to run while machine sleeps
- Playwright skill bundled into CC for browser automation against authed sites
- (Decided against) Apple Watch / HealthKit integration. Native watch app (`rowan-watch/`) was scrapped in favor of manual weight + rep entry from the dashboard. If HealthKit becomes useful later, the easiest path is the "Health Auto Export" app → daily CSV → ingestion script, not another Swift codebase.
- (Stale, not active) The old in-house worker runtime + jarvis_workers/jarvis_worker_runs/jarvis_universal_lessons tables. The tables remain in Supabase but nothing reads or writes them. Drop in a future migration if not reactivated.

### Pending (needs user action)
- Run `0002_redesign_tables.sql` in Supabase SQL Editor (if not yet applied)
- Run `0003_fitness_intelligence.sql` in Supabase SQL Editor (if not yet applied)
- Run `0004_oura_expansion.sql` in Supabase SQL Editor — adds stress, resilience, vo2_max, workouts columns
- Run `0005_protein_logger.sql` in Supabase SQL Editor — creates protein_logs table
- Run `0006_coach_extensions.sql` in Supabase SQL Editor — creates morning_briefings, weekly_reviews, goal_templates tables
- Run `0007_lifemax_business.sql` in Supabase SQL Editor — category columns on supplement_stack + journal_entries
- Run `0008_jarvis.sql` in Supabase SQL Editor — Jarvis tables (facts, workers, runs, conversations)
- Run `0009_jarvis_artifacts.sql` in Supabase SQL Editor — artifact storage for worker outputs
- Run `0010_jarvis_universal_lessons.sql` in Supabase SQL Editor — universal lesson table
- (Obsolete) `CRON_SECRET` is no longer needed — the in-house cron dispatcher has been removed in favor of Claude Code's native scheduling (`/loop` from inside an agent).
- Optional: add `TAVILY_API_KEY` env var (free tier at tavily.com — 1000 searches/mo) to enable `web_search` tool. Without it, workers that try to search get an error message but everything else works.
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
- **Vercel deployment** — all 9 env vars must be set in Vercel dashboard (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OURA_PAT`, `WORKOUT_API_KEY`, `APP_PASSCODE`, `AUTH_EMAIL`, `AUTH_PASSWORD`)

### Auth — 4-digit passcode (replaces magic link)
- `/login` page renders four single-digit boxes. On full entry, POSTs to `/api/auth/passcode`.
- Server route checks the code against `APP_PASSCODE` env var. If match, calls `signInWithPassword` using `AUTH_EMAIL` + `AUTH_PASSWORD` env vars — same Supabase account every time.
- Supabase session cookies handle persistence (~1 week default, auto-refresh). User only re-enters the code if cookies expire or are cleared.
- The Supabase user must have a password set (one-time manual step in Supabase Dashboard → Authentication → Users → Edit user).
