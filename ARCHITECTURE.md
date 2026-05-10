# Rowan Dashboard — Architecture & Build Spec

## Overview

A PWA self-improvement dashboard built with Next.js (App Router), Supabase, and Tailwind CSS. Runs as a full-screen web app on iPhone (added to home screen) and as a desktop browser tab. All data lives in Supabase. The Overseer is a persistent AI agent with read access to every table, running both on-demand chat and scheduled background analysis.

---

## Visual Design System

Pulled directly from the screenshots:

| Token | Value |
|---|---|
| Background | `zinc-950` (#09090b) |
| Card surface | `zinc-900` (#18181b) with `border border-zinc-800` |
| Card border | `zinc-800` (#27272a) |
| Section label | `zinc-500` uppercase, tracked, 11px — prefixed with `—` |
| Body text | `zinc-100` |
| Muted text | `zinc-400` |
| Accent green | `#22c55e` (good states, streaks, online dot) |
| Accent orange | `#f97316` (watch out, midday energy, strain) |
| Accent blue | `#3b82f6` (meds, hydration, sleep indicators) |
| Accent red | `#ef4444` (blacklisted, danger) |
| Large stat numbers | `text-5xl font-bold text-white` |
| Section separator | `—` in `zinc-600` + `h-px bg-zinc-800` |
| Badge style | `text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm` |

Typography: `font-sans` (Inter or Geist). Section headers: `text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500`. Large numbers: `font-bold`. Body: `text-sm font-normal`.

---

## Full File Structure

```
rowan-dashboard/
├── app/
│   ├── layout.tsx                    # Root layout, PWA meta, font load
│   ├── page.tsx                      # Main dashboard (redirects to /main)
│   ├── globals.css                   # Tailwind base + custom scrollbar
│   │
│   ├── (app)/
│   │   ├── layout.tsx                # App shell: top header bar + bottom nav
│   │   │
│   │   ├── main/
│   │   │   └── page.tsx              # Main tab: Overseer + Goalmaxxing + Peak Window
│   │   │
│   │   ├── health/
│   │   │   └── page.tsx              # Health tab: Oura stats + Daily Stack + Med trackers
│   │   │
│   │   ├── fitness/
│   │   │   └── page.tsx              # Fitness tab: Progressive Overload Coach
│   │   │
│   │   ├── finances/
│   │   │   └── page.tsx              # Finances tab: Subscriptions + Budget + Wishlist
│   │   │
│   │   └── brand/
│   │       └── page.tsx              # Brand tab (placeholder)
│   │
│   └── api/
│       ├── overseer/
│       │   ├── chat/
│       │   │   └── route.ts          # Streaming chat endpoint (Claude API)
│       │   └── context/
│       │       └── route.ts          # Returns full dashboard context snapshot
│       │
│       ├── oura/
│       │   └── poll/
│       │       └── route.ts          # Cron-triggered polling of Oura Cloud API v2, upserts health_logs
│       │
│       └── cron/
│           └── analyze/
│               └── route.ts          # Called by Supabase cron: runs proactive analysis
│
├── components/
│   │
│   ├── layout/
│   │   ├── AppShell.tsx              # Wraps all pages, renders header + nav
│   │   ├── TopHeader.tsx             # "THU, MAY 7  LEGS DAY" bar + quick stats
│   │   ├── BottomNav.tsx             # Mobile nav: Main / Finances / Brand / Search / Health / Gym
│   │   └── SectionLabel.tsx          # Reusable "— SECTION NAME" header component
│   │
│   ├── overseer/
│   │   ├── OverseerWidget.tsx        # Full chat card with avatar, online dot, input bar
│   │   ├── OverseerMessage.tsx       # Individual message bubble (user vs AI)
│   │   └── OverseerInput.tsx         # Mic icon + text input + send button
│   │
│   ├── health/
│   │   ├── OuraStatsBar.tsx          # Readiness circle + Sleep / Activity / HRV / RHR / SpO2
│   │   ├── ReadinessRing.tsx         # SVG circular progress (teal gradient for readiness %)
│   │   ├── SleepStages.tsx           # Horizontal bar: REM / Deep / Light / Awake
│   │   ├── TodaysCall.tsx            # GREEN/YELLOW/RED badge + AI-written recommendation
│   │   ├── TimeRing.tsx              # Orange circular progress for awake-time-remaining
│   │   ├── EnergyGraph.tsx           # Recharts area graph: Peak / Steady / Foggy windows
│   │   ├── PeakWindowCard.tsx        # Wraps EnergyGraph with current status label
│   │   ├── DailyStack.tsx            # Full supplement checklist component
│   │   ├── StackItem.tsx             # Single supplement row (tap to toggle)
│   │   ├── AddStackItem.tsx          # Inline form: Name + Dose + Timing
│   │   ├── MedicationTracker.tsx     # Concerta card with CTA button + pharmacokinetics note
│   │   └── VeloTracker.tsx           # Daily intake counter with + / - buttons
│   │
│   ├── productivity/
│   │   ├── GoalmaxxingCard.tsx       # Today's goals list + streak counter + Add input
│   │   ├── GoalItem.tsx              # Single goal row (tap to complete, lightning bolt priority)
│   │   ├── StreakBadge.tsx           # ⚡ N DAY STREAK badge
│   │   └── PushToTomorrow.tsx        # Arrow button to defer remaining goals
│   │
│   ├── fitness/
│   │   ├── GymToggle.tsx             # Segmented control: Les Roches / Clever Fit
│   │   ├── DayToggle.tsx             # Segmented control: Push / Pull / Legs
│   │   ├── ExerciseSelector.tsx      # Dropdown to pick current exercise
│   │   ├── SetLogger.tsx             # Weight input + Reps number picker + Log Set button
│   │   ├── NextSessionCard.tsx       # Highlighted card: "20kg × 6 reps — REPEAT"
│   │   ├── ExerciseStats.tsx         # EST. 1RM / BEST SET / SESSIONS stats row
│   │   ├── TrendGraph.tsx            # Recharts line: last 10 sessions trend
│   │   ├── SessionHistory.tsx        # List of past set logs (date + weight × reps)
│   │   └── WorkoutDoneButton.tsx     # "Mark workout done" CTA
│   │
│   ├── finances/
│   │   ├── MonthlyBurnCard.tsx       # $168/mo total + per-sub list
│   │   ├── SubscriptionRow.tsx       # Service name + amount + renewal date + remove
│   │   ├── AddSubscription.tsx       # Inline form for new sub
│   │   ├── IncomingOrders.tsx        # Tag cloud of items on the way
│   │   ├── BudgetCard.tsx            # Weekly/hall budget item list + total
│   │   └── WishlistCard.tsx          # Still to buy + Future tags
│   │
│   └── ui/
│       ├── CircularProgress.tsx      # Generic SVG ring (used by Recovery + TimeRing)
│       ├── StatCard.tsx              # Small labeled stat box
│       ├── Badge.tsx                 # Generic badge (color variants)
│       ├── Card.tsx                  # zinc-900 card wrapper
│       ├── Toggle.tsx                # Segmented control primitive
│       └── Input.tsx                 # Styled dark input field
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # createBrowserClient (for client components)
│   │   ├── server.ts                 # createServerClient (for server components + API routes)
│   │   └── types.ts                  # Auto-generated DB types (from supabase gen types)
│   │
│   ├── ai/
│   │   ├── overseer.ts               # Claude client setup + system prompt builder
│   │   ├── context-builder.ts        # Assembles full dashboard snapshot for AI context
│   │   └── prompts.ts                # All system prompts (chat, daily analysis, today's call)
│   │
│   └── oura/
│       └── client.ts                 # Oura Cloud API v2 OAuth2 + data fetch helpers
│
├── hooks/
│   ├── useOverseer.ts                # Chat state, streaming, message history
│   ├── useOura.ts                    # Realtime subscription to health_logs
│   ├── useGoals.ts                   # Goals CRUD + streak logic
│   ├── useStack.ts                   # Supplement log state
│   ├── useWorkout.ts                 # Workout logging + next-session calculation
│   └── useRealtime.ts                # Generic Supabase realtime hook
│
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql   # All tables (see schema section)
│   │
│   ├── functions/
│   │   ├── overseer-background/      # Edge Function: hourly proactive analysis
│   │   │   └── index.ts
│   │   └── daily-reset/              # Edge Function: resets daily logs at 6 AM
│   │       └── index.ts
│   │
│   └── seed.sql                      # Default supplement stack + exercise library
│
├── public/
│   ├── manifest.json                 # PWA manifest (name, icons, display: standalone)
│   ├── icons/                        # PWA icons at 192px and 512px
│   └── sw.js                         # Service worker (offline shell cache)
│
├── middleware.ts                     # Supabase auth session refresh on every request
├── next.config.ts                    # PWA headers, image domains
├── tailwind.config.ts                # Custom colors, font, animation
└── .env.local                        # Supabase URL/key, Claude key, WHOOP credentials
```

---

## Database Schema (Supabase / PostgreSQL)

### `profiles`
```sql
id            uuid PRIMARY KEY REFERENCES auth.users
full_name     text
timezone      text DEFAULT 'Europe/Zurich'
wake_time     time DEFAULT '08:00'
sleep_target  time DEFAULT '00:00'
created_at    timestamptz DEFAULT now()
```

### `health_logs` (Oura Ring data, one row per day)
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id          uuid REFERENCES profiles
date             date NOT NULL
readiness_score  int          -- 0–100 (Oura Readiness)
sleep_score      int          -- 0–100 (Oura Sleep Score)
sleep_pct        numeric      -- e.g. 72.0 (sleep efficiency %)
sleep_hours      numeric      -- e.g. 5.9 (total sleep duration)
activity_score   int          -- 0–100 (Oura Activity Score, replaces strain)
hrv              int          -- ms average HRV during sleep, e.g. 126
rhr              int          -- bpm lowest resting HR, e.g. 45
skin_temp_delta  numeric      -- °C deviation from baseline (Oura body temp)
spo2_pct         numeric      -- average SpO2 %
resp_rate        numeric      -- breaths per minute
rem_min          int
deep_min         int
light_min        int
awake_min        int
raw_oura_json    jsonb        -- full Oura Cloud API v2 response
is_final         boolean DEFAULT false  -- false until Oura confirms day is complete
created_at       timestamptz DEFAULT now()
UNIQUE(user_id, date)
```

### `energy_windows` (user-configured daily energy schedule)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES profiles
label       text             -- 'Peak', 'Steady', 'Foggy'
start_time  time
end_time    time
color       text             -- hex color for graph
sort_order  int
```

### `supplement_stack` (the user's permanent supplement list)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES profiles
name        text NOT NULL    -- 'Caffeine', 'Creatine'
dose        text             -- '5g Monohydrate'
timing      text             -- 'Morning', 'Lunch', 'Evening'
notes       text             -- 'Take WITH caffeine — same drink'
cutoff_time time             -- e.g. '12:00' for caffeine
is_active   boolean DEFAULT true
sort_order  int
```

### `supplement_logs` (daily check-ins, resets at 6 AM)
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid REFERENCES profiles
supplement_id uuid REFERENCES supplement_stack
taken_at      timestamptz
log_date      date           -- the "day" this belongs to (6 AM reset)
```

### `medications` (tracked meds like Concerta)
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id        uuid REFERENCES profiles
name           text           -- 'Concerta 18mg'
dose_mg        numeric
notes          text
pharmacokinetics_json jsonb  -- peak/half-life data for timeline display
```

### `medication_logs`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid REFERENCES profiles
medication_id uuid REFERENCES medications
taken_at      timestamptz
log_date      date
```

### `goals` (daily task list)
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid REFERENCES profiles
title         text NOT NULL
goal_date     date NOT NULL
is_complete   boolean DEFAULT false
completed_at  timestamptz
priority      int DEFAULT 1   -- maps to lightning bolt icon
pushed_from   date            -- if deferred from a previous day
created_at    timestamptz DEFAULT now()
```

### `goal_streaks`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES profiles
current_streak  int DEFAULT 0
longest_streak  int DEFAULT 0
last_complete_date date
updated_at      timestamptz DEFAULT now()
```

### `gym_locations`
```sql
id    uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid REFERENCES profiles
name  text   -- 'Les Roches', 'Clever Fit'
```

### `exercises`
```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id      uuid REFERENCES profiles
name         text NOT NULL    -- 'Hammer Curls'
muscle_group text             -- 'Biceps'
split_day    text             -- 'Pull', 'Push', 'Legs'
gym_id       uuid REFERENCES gym_locations
```

### `workout_sets` (every logged set)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES profiles
exercise_id uuid REFERENCES exercises
gym_id      uuid REFERENCES gym_locations
split_day   text
weight_kg   numeric
reps        int
est_1rm     numeric          -- computed: weight × (1 + reps/30)
logged_at   timestamptz DEFAULT now()
log_date    date
```

### `overseer_messages` (full chat history)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid REFERENCES profiles
role        text             -- 'user' | 'assistant'
content     text
created_at  timestamptz DEFAULT now()
```

### `overseer_insights` (proactive background analysis outputs)
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid REFERENCES profiles
insight_type  text           -- 'daily_call', 'trend_alert', 'goal_nudge'
title         text
body          text
severity      text           -- 'green', 'yellow', 'red'
triggered_at  timestamptz DEFAULT now()
dismissed_at  timestamptz
```

### `subscriptions`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid REFERENCES profiles
service_name  text
amount        numeric
currency      text DEFAULT 'USD'
billing_cycle text            -- 'Monthly', 'Yearly'
next_renewal  date
created_at    timestamptz DEFAULT now()
```

### `budget_items`
```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id    uuid REFERENCES profiles
label      text
amount_chf numeric
category   text              -- 'weekly', 'hall', etc.
```

### `incoming_orders`
```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id    uuid REFERENCES profiles
item_name  text
expected_by date
arrived_at timestamptz
```

### `wishlist_items`
```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id    uuid REFERENCES profiles
item_name  text
urgency    text    -- 'now', 'future'
purchased_at timestamptz
```

---

## The Overseer: Architecture Deep-Dive

### What It Is
The Overseer is not a simple chatbot. It is a stateful AI agent that:
1. Has persistent read access to every Supabase table via a service-role client
2. Runs proactive hourly analysis in the background (Supabase Edge Function)
3. Surfaces insights as push notifications and in-app badges
4. Responds to on-demand chat with full dashboard context in every message

### Context Builder (`lib/ai/context-builder.ts`)
Every time the Overseer receives a message (chat or background), this function assembles a full JSON snapshot:

```
{
  today: { date, split, workoutComplete },
  health: { readiness, sleepScore, activityScore, hrv, rhr },
  goals: { total, complete, pending: [...], streak },
  supplements: { taken: [...], missed: [...] },
  medications: { concerta: { takenToday, minutesAgo } },
  energy: { currentWindow: 'Steady', minutesUntilFoggy: 45 },
  fitness: { lastSession: {...}, nextTarget: {...} },
  finances: { monthlyBurn, renewalsThisWeek: [...] }
}
```

This context is injected into every Claude API call as the system prompt prefix.

### On-Demand Chat (`app/api/overseer/chat/route.ts`)
- POST with `{ message: string }`
- Fetches last 20 `overseer_messages` for conversation history
- Calls Claude API with streaming enabled
- Saves both user message and assistant response to `overseer_messages`
- Returns SSE stream to client for word-by-word rendering

### Background Analysis (`supabase/functions/overseer-background/index.ts`)
Runs every hour via Supabase cron (`pg_cron`). Logic:

```
1. Pull full context snapshot for the user
2. Run analysis prompt against Claude:
   - Are any supplement windows being missed?
   - Is today's goal completion on pace?
   - Any readiness/activity trends worth flagging?
   - Is the user in their crash window — what should they be doing?
3. If insight severity >= 'yellow':
   - INSERT into overseer_insights
   - Supabase Realtime broadcasts to client
   - Client surfaces as a dismissible banner in the Overseer widget
```

### Daily Reset (`supabase/functions/daily-reset/index.ts`)
Runs at 6:00 AM user-local time. Resets supplement_logs for the new day. Computes goal streak (if all goals complete yesterday, increment streak). Generates the "Today's Call" insight once Oura readiness data is marked `is_final` (typically within 30 min of waking).

### System Prompt (`lib/ai/prompts.ts`)
```
You are the Overseer. You are a direct, high-performance life coach embedded in a personal dashboard. 
You have real-time access to the user's health data, goals, workouts, supplements, and schedule.
Be concise. Lead with the most important thing. Never be vague.
Today's context: [CONTEXT_JSON]
```

---

## Oura Ring Integration

Oura Cloud API v2 does not push webhooks to free/personal accounts — data is fetched by polling.

1. User connects Oura via OAuth2 or Personal Access Token (stored in `profiles`)
2. Supabase cron triggers `/api/oura/poll` every 15 minutes
3. Route calls Oura API endpoints:
   - `GET /v2/usercollection/daily_readiness` → readiness score
   - `GET /v2/usercollection/daily_sleep` → sleep score, stages, efficiency
   - `GET /v2/usercollection/daily_activity` → activity score
   - `GET /v2/usercollection/daily_spo2` → SpO2
   - `GET /v2/usercollection/daily_stress` → stress/recovery balance
   - `GET /v2/usercollection/heartrate` → continuous HR data
4. Route upserts into `health_logs` and triggers Supabase Realtime broadcast
5. All health components subscribe to Realtime for live updates

Oura data for the current day is often preliminary until the ring syncs fully after waking — the poll route checks `contributors` completeness and marks rows as `is_final`.

For development/demo: mock Oura data is seeded via `supabase/seed.sql`.

---

## PWA Setup

`public/manifest.json`:
```json
{
  "name": "Rowan Dashboard",
  "short_name": "Rowan",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "start_url": "/main",
  "icons": [{ "src": "/icons/192.png", "sizes": "192x192" }, { "src": "/icons/512.png", "sizes": "512x512" }]
}
```

`next.config.ts` adds the `Link: rel=manifest` header and configures `viewport` for full-screen iPhone behavior.

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # used only in server/edge functions
ANTHROPIC_API_KEY=                # Claude API for Overseer
OURA_CLIENT_ID=                   # from Oura developer portal
OURA_CLIENT_SECRET=
OURA_PERSONAL_ACCESS_TOKEN=       # shortcut for single-user use (skip OAuth2 flow)
CRON_SECRET=                      # validates /api/cron/* and /api/oura/poll calls
```

---

## Key Dependencies

```json
{
  "next": "15.x",
  "react": "19.x",
  "@supabase/supabase-js": "^2",
  "@supabase/ssr": "^0.5",
  "@anthropic-ai/sdk": "^0.39",
  "recharts": "^2.x",
  "tailwindcss": "^4.x",
  "date-fns": "^3.x",
  "lucide-react": "latest"
}
```

---

## Bottom Navigation Tabs (matching screenshots)

| Icon | Label | Route | Maps to |
|---|---|---|---|
| Home | Main | /main | Overseer + Goalmaxxing + Peak Window |
| Dollar | Finances | /finances | Subscriptions + Budget + Orders |
| Box | Brand | /brand | (placeholder) |
| Search | Search | /search | Global search across all modules |
| Heart | Health | /health | Oura + Stack + Meds |
| Dumbbell | Gym | /fitness | Progressive Overload Coach |

---

## Init Command

Run this exact command in your terminal. It scaffolds Next.js 15 with App Router, TypeScript, Tailwind, and ESLint — exactly the stack described above:

```bash
npx create-next-app@latest rowan-dashboard --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" && cd rowan-dashboard
```

After approval, the next steps will be:
1. Install all dependencies (Supabase, Anthropic, Recharts, etc.)
2. Create `supabase/migrations/0001_initial_schema.sql` with the full schema above
3. Build the component library bottom-up: `ui/` primitives → layout shell → individual module components
4. Wire up Supabase realtime hooks
5. Build the Overseer API routes and context builder
6. Configure PWA manifest and service worker
