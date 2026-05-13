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
[ Home ]  [ LifeMax ]  [ +LOG ]  [ Gym ]  [ Business ]
```

| Tab | Route | Description |
|-----|-------|-------------|
| Home | `/home` | Daily score, goals ticker, briefing, weekly review, day ring |
| LifeMax | `/lifemax` | VIEW: Oura biometrics, protein progress, routine items (supps/meds/injections/skincare — tappable inline), long-term goals, recent personal journal entries |
| **Jarvis (center)** | full-screen overlay | The system operator. Pulsing orb HUD with voice-to-voice chat, ambient telemetry, tool execution. Replaces +LOG button. |
| Gym | `/gym` | Hypertrophy coach + recovery + strain + weekly volume |
| Business | `/business` | Business + career goals, recent business journal entries (view-only) |

**Logging architecture principle:** the interaction *shape* drives where it lives, not whether it's daily.
- **Checklist** (recurring fixed list — supplements, meds, injections, skincare) → tapped inline on LifeMax (you need to see what's left)
- **Counter / single-event log** (water, mood, weight, alcohol, brain dump, protein, etc) → +LOG popup (one surface for "I want to record something")
- **Brain dump is ONE entry** in +LOG with a Personal/Business/Other tag. LifeMax shows personal-tagged entries; Business shows business-tagged. No duplicate brain dump UI.

The `+` center button is NOT a route. `BottomNav.tsx` holds `useState<boolean>` for `LogSheet` open/close. `LogSheet` renders inside BottomNav's JSX tree so it survives tab navigation.

Old routes redirect:
- `/main` → `/home`
- `/life` → `/lifemax`
- `/coach` → `/home` (Overseer is now a floating bubble on Home)
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
│   │   ├── context-builder.ts  # Builds full JSON context for AI (22 parallel queries, recovery + strain + perf correlations)
│   │   ├── snapshot-builder.ts # 21-day wide-format CSV — auto-discovery layer for the Overseer
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
│       └── 0009_jarvis_artifacts.sql      # jarvis_artifacts — worker outputs (blog posts, plans, reports)
│
└── rowan-watch/                          # Standalone native watchOS companion app
    ├── README.md                         # Build/install guide (Xcode + dev cert)
    └── RowanWatch Watch App/
        ├── Constants.swift               # apiBase + apiKey + userId (paste-in setup)
        ├── APIClient.swift               # fetchExercises + logSet → calls Rowan API
        ├── RowanWatchApp.swift           # App entry
        ├── ContentView.swift             # Split picker (Push/Pull/Legs) + exercise list
        ├── SetupView.swift               # Weight picker (Digital Crown, 2.5kg steps)
        ├── ActiveSetView.swift           # Live rep counter + post-set confirm + log
        └── RepDetector.swift             # Schmitt-trigger over Core Motion (50Hz),
                                          # auto-tunes thresholds per exercise type
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
Runs before every AI call (chat + analyze). 22 parallel Supabase queries. Passes:
- Today's snapshot: goals, supplements, medications, workouts, health, mood, faith, water, daily plan
- **7-day trends**: HRV direction + declining streak, readiness direction, sleep avg, mood avg
- **14-day correlations**: per-supplement vs. deep sleep delta (if ≥15min delta + ≥2 data points → plain English fact)
- **Goal patterns**: 7-day win rate, list of goals with <50% completion this week
- **Recovery**: composite score (50% readiness + 30% HRV dev + 20% sleep), band, drivers, today's strain, hours since workout
- **Performance correlations (21-day)**: readiness→volume %, sleep→reps gap, per-supplement→volume %, Concerta→volume %, PRs this week by exercise, stalled exercises by name
- **Autonomous discovery layer (`lib/ai/snapshot-builder.ts`)**: 21-day wide-format CSV table — one row per date, one column per metric (health, supplements, meds, training, lifestyle, faith, goals, per-supplement booleans). Overseer scans for patterns NOT covered by pre-computed correlations. New metrics added to the app automatically become columns. **Used by both chat AND proactive analyze flow.**
- **Anti-repeat memory**: context.recentInsights[] contains last 5 surfaced insights with hoursAgo. Analyze prompt explicitly avoids repeating the same insight within 24h — finds new angles or returns null.

### Proactive Surfacing
- `components/layout/ProactiveCheck.tsx` lives in the (app) shell layout. On page mount, if last insight is > 90 min old, hits `/api/overseer/analyze`.
- Analyze runs Haiku with `buildAnalysisPrompt` — instructed to surface ONE insight that's either actionable OR a noteworthy pattern from the daily snapshot.
- Inserts into `overseer_insights` table → surfaces as dismissible banner at top of every app page AND in Coach insights strip.
- Anti-repeat: AI sees its recent 5 insights and won't repeat them.

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
- Protein logger (manual + photo + barcode) with AI vision scoring (0-100 for lean aesthetic muscle suitability); only protein persisted, score is metadata; daily target = weight × 2.0g/kg
- Per-muscle local fatigue tracking — hours since last hit, hard sets last 48h, RPE memory
- Auto-adjusted lift prescriptions: weight × reps × sets × RPE cap modified based on recovery + muscle status (evidence-based, RP-style)
- **Settings page** at /settings (gear icon in TopHeader) — edit profile, supplements, exercises, gyms, recurring goal templates, sign out
- **Welcome card** auto-appears on Home when supplements + exercises + weight are all empty
- **Morning briefing** — Haiku-generated 3-sentence brief, fires once per day on app open, stored in `morning_briefings`
- **Weekly review** — Sonnet 4.6-generated letter, auto-fires Sunday after 8am, stored in `weekly_reviews`, shown as expandable card on Home
- **Conversational goal completion** — Overseer chat now executes tool calls (log water, complete goal, log supplement, log protein, etc.) via Anthropic tool use. Tool results stream as ✓ chips above the assistant's text response.
- **Goal templates** — recurring goals auto-populate daily goal list each morning via `goal_templates` table
- 4-digit passcode auth flow (proxy.ts gates non-public paths)
- Deployed on Vercel + accessible on iPhone as PWA (manifest, apple touch icon SVG, status bar styling)

### Native Apple Watch companion app (`rowan-watch/`)
Standalone watchOS SwiftUI app. NOT bundled with the PWA — built separately in Xcode and installed via free or paid Apple Developer account.

**Workflow on the watch:**
1. Pick split day (Push/Pull/Legs) → exercise list loads from `/api/workouts/exercises`
2. Pick exercise → SetupView
3. Set weight via Digital Crown (2.5kg steps)
4. Tap "Start Set" → `RepDetector` starts accelerometer at 50Hz, counts reps live with haptic per rep
5. Tap "Done" → confirm screen, scroll crown to adjust if miscounted
6. Tap "Log Set ✓" → POSTs to `/api/workouts/log-set` with `WORKOUT_API_KEY` auth
7. PWA dashboard updates via Supabase Realtime (no refresh needed)

**Rep detection algorithm:** Schmitt-trigger on EMA-smoothed accel magnitude. Per-rep haptic. Thresholds **auto-tune per exercise** based on `muscle_group` + `exercise_type`:
- `lower-body` (Quads/Hams/Glutes/Calves): HIGH 0.18g, LOW 0.08g, gap 0.7s — wrist barely moves under heavy bracing
- `isolation` (upper-body Isolation): HIGH 0.25g, LOW 0.12g, gap 0.7s — slower controlled tempo
- `compound` (upper-body Compound): HIGH 0.35g, LOW 0.15g, gap 0.5s — strong predictable motion
- `default` (everything else): HIGH 0.30g, LOW 0.13g, gap 0.55s

Active profile is shown under the live counter. Editing `exercise_type` in the dashboard Settings page automatically updates the profile on the watch's next fetch.

**Accuracy realism:** ~90% on upper-body compound/isolation; ~40-60% on squat/deadlift/leg press (the wrist barely moves). The Done screen's manual count adjustment is the safety net for poorly-tracked lifts.

### Jarvis (system operator)
Full-screen voice-to-voice assistant. Modeled after Tony Stark's Jarvis. Lives at the center of the bottom nav — tap the glowing orb to open the HUD.

**Architecture:**
- `app/(app)/jarvis/JarvisHUD.tsx` — full-screen overlay: pulsing animated orb (`Orb.tsx`) + corner telemetry (time, recovery, goals, protein, streak) + hold-to-talk mic + text fallback
- `lib/jarvis/voice.ts` — `webkitSpeechRecognition` STT + `speechSynthesis` TTS, picks "Daniel" UK voice when available, sentence-buffered streaming speaker
- `lib/jarvis/prompts.ts` — Jarvis persona prompt (formal, dry, addresses user as "Sir")
- `lib/jarvis/memory.ts` — read/write `jarvis_facts` with confidence reinforcement
- `lib/jarvis/runner.ts` — `runWorker(id)` orchestration loop with tool use

**Memory:** `jarvis_facts` table. Jarvis writes facts via `remember_fact` tool, reads them on every conversation. Duplicates reinforce confidence rather than create new rows.

**Workers (autonomous sub-agents):** `jarvis_workers` defines them, `jarvis_worker_runs` tracks each run.
- Vercel Cron at `*/15 * * * *` hits `/api/jarvis/cron/dispatch` (auth via `CRON_SECRET`)
- Dispatcher finds workers with `next_run_at <= now()` and fires `runWorker` for each
- Each run: build context + worker's system prompt + `learned_facts` → Claude with the worker's `allowed_tools` → loop tool calls → save output + AI summary
- Jarvis can `create_worker`, `dispatch_worker`, `list_workers` via tool calls (deploy workers conversationally)
- Each run can write back to `learned_facts` JSONB (this is the "gets smarter" mechanic)

**Tools Jarvis has** (`lib/ai/tools.ts`):
- **Logging**: log_water, log_protein, log_meditation, log_mood, log_weight, log_alcohol, log_concerta, log_supplement, complete_goal, mark_prayed, mark_bible, mark_church
- **Memory**: remember_fact, recall_facts
- **Workers**: dispatch_worker, create_worker, list_workers
- **Capabilities (primitives that make workers actually useful)**:
  - `fetch_url(url, method?, headers?, body?)` — generic HTTP, 80KB cap, SSRF-blocked for private IPs
  - `web_search(query, max_results?)` — Tavily API (free tier; needs TAVILY_API_KEY env var)
  - `write_artifact(name, content, type?)` — persists substantial outputs to `jarvis_artifacts`
  - `list_artifacts(limit?)` — recent artifacts
  - `read_artifact(id_or_name)` — retrieve full content
- **Client interaction**: open_url (returns __OPEN_URL__ marker → SSE openUrl → window.open in browser)

**Workers additionally have** (`WORKER_TOOLS` constant, not in chat):
- **`code_execution`** — Anthropic-hosted Python sandbox (server tool, beta header `code-execution-2025-08-25`). Worker writes + runs Python at runtime: pip-install packages, scrape pages, parse JSON/CSV, do math, generate plots. This is the "figure it out without me hand-coding" capability — workers can do almost anything code can do.

Workers run via `lib/jarvis/runner.ts` which passes the beta header to `anthropic.messages.create`. Server tool blocks (`server_tool_use`, `code_execution_tool_result`) are preserved in the assistant message verbatim so Claude can iterate on results.

**`open_url` mechanic:** server-side returns a special `__OPEN_URL__<url>` marker → SSE `openUrl` event → client `window.open()`. The only client-side "computer interaction" a PWA can do.

**Voice quality:** free system voice for V1. Easy upgrade to ElevenLabs/Cartesia via API swap later.

### Future (V2+)
- Native desktop wrapper (Tauri) for true computer control — open IDEs, run shell commands, manipulate windows
- ElevenLabs / Cartesia voice for cinematic Jarvis sound
- pgvector embeddings memory (upgrade from ILIKE search)
- Specific pre-built workers: SEO content generator, GoDaddy domain monitor, Roblox trend scraper, email auto-responder
- Apple HealthKit via Capacitor wrapper (HR + calories from Apple Watch into context)

### Pending (needs user action)
- Run `0002_redesign_tables.sql` in Supabase SQL Editor (if not yet applied)
- Run `0003_fitness_intelligence.sql` in Supabase SQL Editor (if not yet applied)
- Run `0004_oura_expansion.sql` in Supabase SQL Editor — adds stress, resilience, vo2_max, workouts columns
- Run `0005_protein_logger.sql` in Supabase SQL Editor — creates protein_logs table
- Run `0006_coach_extensions.sql` in Supabase SQL Editor — creates morning_briefings, weekly_reviews, goal_templates tables
- Run `0007_lifemax_business.sql` in Supabase SQL Editor — category columns on supplement_stack + journal_entries
- Run `0008_jarvis.sql` in Supabase SQL Editor — Jarvis tables (facts, workers, runs, conversations)
- Run `0009_jarvis_artifacts.sql` in Supabase SQL Editor — artifact storage for worker outputs
- Add `CRON_SECRET` env var in Vercel (any random string) so the worker dispatcher can authenticate
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
