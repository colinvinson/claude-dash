-- ============================================================
-- APPLY_ALL.sql — paste-once catch-up for migrations 0019 → 0034
-- ============================================================
--
-- Concatenation of every migration after the 0018 catch-up.
-- Each underlying migration is idempotent (CREATE TABLE IF NOT
-- EXISTS, ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS
-- before CREATE POLICY, ALTER PUBLICATION wrapped in
-- duplicate_object exception handlers, etc), so running this
-- file is safe at any point — already-applied changes no-op.
--
-- Workflow:
--   1. Open Supabase SQL Editor
--   2. Paste the whole contents of this file
--   3. Run
--
-- Every future migration added to this folder should ALSO be
-- appended to this file so a single paste stays sufficient.
-- See AGENTS.md for the rule.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 0019_mesocycles.sql
-- ──────────────────────────────────────────────────────────
-- Mesocycle programming for the hypertrophy coach.
--
-- A mesocycle is a 4-6 week block where weekly volume ramps from MEV up
-- toward MRV, followed by a deload week at ~50% volume. After the block
-- ends, the user starts a new one (which may anchor MEV higher than before).
--
-- One mesocycle is "active" at a time per user (ended_at IS NULL).
--
-- `muscle_priorities` lets the user mark muscles as "specialize" (hold near
-- MRV every week — for lagging body parts) or "maintenance" (stay at MEV).
-- Unmarked muscles get the normal linear ramp.

CREATE TABLE IF NOT EXISTS public.mesocycles (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_date        DATE NOT NULL,
  planned_weeks     INT NOT NULL DEFAULT 5 CHECK (planned_weeks BETWEEN 3 AND 8),
  -- JSONB of { "Chest": "specialize" | "maintenance" } — absent muscles
  -- default to normal ramp.
  muscle_priorities JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes             TEXT,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active mesocycle at a time per user.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_meso_per_user
  ON public.mesocycles(user_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meso_user_dates
  ON public.mesocycles(user_id, start_date DESC);

ALTER TABLE public.mesocycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mesocycles_own" ON public.mesocycles;
CREATE POLICY "mesocycles_own" ON public.mesocycles
  FOR ALL USING (auth.uid() = user_id);

-- Surface on Realtime so the dashboard updates the second a new one starts /
-- the current one ends.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mesocycles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mesocycles;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 0020_running_low.sql
-- ──────────────────────────────────────────────────────────
-- Mark stack items as "running low" — drives the supply reminder badge on the
-- Schedule timeline. Toggled directly from each row; user clears it after
-- reordering.

ALTER TABLE public.supplement_stack
  ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────
-- 0021_insight_kind.sql
-- ──────────────────────────────────────────────────────────
-- Tag jarvis_insights rows by kind so background detectors (e.g. the
-- daily personal-best detector) can dedupe within a day without scanning
-- every insight's text.
ALTER TABLE public.jarvis_insights
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general';
CREATE INDEX IF NOT EXISTS idx_insights_user_kind_date
  ON public.jarvis_insights(user_id, kind, triggered_at DESC);

-- ──────────────────────────────────────────────────────────
-- 0022_gym_equipment.sql
-- ──────────────────────────────────────────────────────────
-- Gym equipment selector. Sir marks which machines / equipment categories his
-- gym has; the optimization engine uses this to filter recommendations so it
-- never suggests an exercise he can't actually do.
--
-- TEXT[] of equipment ids matching lib/fitness/equipment.ts. Default empty
-- (no equipment marked yet → engine assumes generic barbell + dumbbell setup).

ALTER TABLE public.gym_locations
  ADD COLUMN IF NOT EXISTS available_equipment TEXT[] NOT NULL DEFAULT '{}';

-- Dismissed coach recommendations. Tiny table — one row per (user, rec_id)
-- that Sir has said "not interested" to. Engine filters these out so a
-- declined swap doesn't keep re-appearing every page load.
CREATE TABLE IF NOT EXISTS public.coach_dismissals (
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rec_id       TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rec_id)
);
ALTER TABLE public.coach_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_dismissals_own" ON public.coach_dismissals;
CREATE POLICY "coach_dismissals_own" ON public.coach_dismissals
  FOR ALL USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 0023_goals_upgrade.sql
-- ──────────────────────────────────────────────────────────
-- Long-term goals upgrade: type system, focus flag, milestones, metric log.
--
-- Goals are the central purpose of the dashboard — every other surface
-- ultimately serves moving them forward. This migration adds the structure
-- needed for goals to feel like a real tracking system, not just an
-- accordion of titles + AI plans.

-- ── 1. Type system + focus flag + quantitative fields on long_term_goals ──
ALTER TABLE public.long_term_goals
  ADD COLUMN IF NOT EXISTS goal_type      TEXT NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS target_value   NUMERIC,
  ADD COLUMN IF NOT EXISTS starting_value NUMERIC,
  ADD COLUMN IF NOT EXISTS metric_unit    TEXT,
  ADD COLUMN IF NOT EXISTS is_focus       BOOLEAN NOT NULL DEFAULT false;

-- Constrain goal_type to known values. Done as DO-block so re-runs don't fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'long_term_goals' AND constraint_name = 'long_term_goals_goal_type_check'
  ) THEN
    ALTER TABLE public.long_term_goals
      ADD CONSTRAINT long_term_goals_goal_type_check
      CHECK (goal_type IN ('quantitative', 'behavioral', 'project', 'aesthetic'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_long_term_goals_focus
  ON public.long_term_goals(user_id) WHERE is_focus = true AND is_active = true;

-- ── 2. Goal milestones — intermediate checkpoints with dates ──
CREATE TABLE IF NOT EXISTS public.goal_milestones (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id      UUID REFERENCES public.long_term_goals(id) ON DELETE CASCADE NOT NULL,
  title        TEXT NOT NULL,
  target_date  DATE,
  target_value NUMERIC,
  is_complete  BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal
  ON public.goal_milestones(goal_id, sort_order);

ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "goal_milestones_own" ON public.goal_milestones;
CREATE POLICY "goal_milestones_own" ON public.goal_milestones
  FOR ALL USING (auth.uid() = user_id);

-- ── 3. Goal metrics — time-series log for quantitative goals ──
-- e.g. "log testosterone = 540 ng/dL on 2026-05-15"
CREATE TABLE IF NOT EXISTS public.goal_metrics (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id   UUID REFERENCES public.long_term_goals(id) ON DELETE CASCADE NOT NULL,
  value     NUMERIC NOT NULL,
  note      TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goal_metrics_goal_time
  ON public.goal_metrics(goal_id, logged_at DESC);

ALTER TABLE public.goal_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "goal_metrics_own" ON public.goal_metrics;
CREATE POLICY "goal_metrics_own" ON public.goal_metrics
  FOR ALL USING (auth.uid() = user_id);

-- ── 4. Realtime ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='goal_milestones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.goal_milestones;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='goal_metrics') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.goal_metrics;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 0024_dimension_expansion.sql
-- ──────────────────────────────────────────────────────────
-- Dimension expansion — make the dashboard see Sir's life in more dimensions
-- than just physical health + body comp. Per the app's mission ("feed
-- maximum info about Sir's self-improvement journey into one unified
-- dashboard so it can guide him in every aspect"), this migration adds
-- the 9 most-impactful missing tracking surfaces:
--
--   focus_sessions   — cognitive output / deep work
--   social_logs      — intentional connection time
--   cardio_logs      — HR-zone work (complements strength tracking)
--   libido_logs      — primary signal for hormone/relationship health
--   aesthetic_logs   — visual progress check-ins
--   caffeine_logs    — distinct from supplements; drives sleep/anxiety
--   sun_logs         — UV exposure (mood, vitamin D, tan goal)
--   learning_logs    — growth dimension
--   money_logs       — financial improvement
--
-- All tables follow the same shape: id, user_id, logged_at, log_date,
-- numeric/text fields specific to the dimension, RLS owns-own-data.

-- ── 1. Focus sessions ──
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  duration_min INT NOT NULL,
  project      TEXT,
  output       TEXT,
  rating       INT,   -- 1-5 quality of the session
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "focus_sessions_own" ON public.focus_sessions;
CREATE POLICY "focus_sessions_own" ON public.focus_sessions FOR ALL USING (auth.uid() = user_id);

-- ── 2. Social interactions ──
CREATE TABLE IF NOT EXISTS public.social_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_name  TEXT,
  kind          TEXT NOT NULL DEFAULT 'in-person', -- in-person | call | text | event
  quality       INT,                                -- 1-5 felt-good rating
  duration_min  INT,
  notes         TEXT,
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_logs_own" ON public.social_logs;
CREATE POLICY "social_logs_own" ON public.social_logs FOR ALL USING (auth.uid() = user_id);

-- ── 3. Cardio sessions ──
CREATE TABLE IF NOT EXISTS public.cardio_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'zone2',  -- zone2 | hiit | walk | run | bike | row | other
  duration_min INT NOT NULL,
  distance_km  NUMERIC,
  hr_avg       INT,
  rpe          INT,                            -- 1-10 perceived effort
  notes        TEXT,
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cardio_logs_own" ON public.cardio_logs;
CREATE POLICY "cardio_logs_own" ON public.cardio_logs FOR ALL USING (auth.uid() = user_id);

-- ── 4. Libido / sexual health ──
CREATE TABLE IF NOT EXISTS public.libido_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 10),
  notes       TEXT,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.libido_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "libido_logs_own" ON public.libido_logs;
CREATE POLICY "libido_logs_own" ON public.libido_logs FOR ALL USING (auth.uid() = user_id);

-- ── 5. Aesthetic check-ins (photos / observations) ──
CREATE TABLE IF NOT EXISTS public.aesthetic_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  angle        TEXT,        -- front | back | side | flex | face
  rating       INT,         -- 1-10 how Sir feels about the look today
  notes        TEXT,
  photo_url    TEXT,        -- optional — Supabase Storage URL if added later
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.aesthetic_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aesthetic_logs_own" ON public.aesthetic_logs;
CREATE POLICY "aesthetic_logs_own" ON public.aesthetic_logs FOR ALL USING (auth.uid() = user_id);

-- ── 6. Caffeine ──
CREATE TABLE IF NOT EXISTS public.caffeine_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mg          INT NOT NULL,
  source      TEXT,        -- coffee | espresso | tea | preworkout | nicotine | etc.
  notes       TEXT,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.caffeine_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "caffeine_logs_own" ON public.caffeine_logs;
CREATE POLICY "caffeine_logs_own" ON public.caffeine_logs FOR ALL USING (auth.uid() = user_id);

-- ── 7. Sun exposure ──
CREATE TABLE IF NOT EXISTS public.sun_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  duration_min    INT NOT NULL,
  with_sunscreen  BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  log_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sun_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sun_logs_own" ON public.sun_logs;
CREATE POLICY "sun_logs_own" ON public.sun_logs FOR ALL USING (auth.uid() = user_id);

-- ── 8. Learning ──
CREATE TABLE IF NOT EXISTS public.learning_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'reading', -- reading | course | podcast | video | practice
  duration_min INT,
  source       TEXT,                            -- book / channel / instructor name
  notes        TEXT,
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learning_logs_own" ON public.learning_logs;
CREATE POLICY "learning_logs_own" ON public.learning_logs FOR ALL USING (auth.uid() = user_id);

-- ── 9. Money (lightweight — daily aggregate, not full ledger) ──
CREATE TABLE IF NOT EXISTS public.money_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount      NUMERIC NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'expense', -- income | expense | savings | business_revenue
  category    TEXT,                              -- groceries | rent | client X | etc.
  notes       TEXT,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.money_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "money_logs_own" ON public.money_logs;
CREATE POLICY "money_logs_own" ON public.money_logs FOR ALL USING (auth.uid() = user_id);

-- ── Realtime publication for all 9 ──
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['focus_sessions','social_logs','cardio_logs','libido_logs','aesthetic_logs','caffeine_logs','sun_logs','learning_logs','money_logs']) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Indexes for the most common queries (user + date range)
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON public.focus_sessions(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_social_logs_user_date    ON public.social_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_cardio_logs_user_date    ON public.cardio_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_libido_logs_user_date    ON public.libido_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_aesthetic_logs_user_date ON public.aesthetic_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_caffeine_logs_user_date  ON public.caffeine_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_sun_logs_user_date       ON public.sun_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_learning_logs_user_date  ON public.learning_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_money_logs_user_date     ON public.money_logs(user_id, log_date DESC);

-- ──────────────────────────────────────────────────────────
-- 0025_monthly_retros.sql
-- ──────────────────────────────────────────────────────────
-- Monthly retrospectives — Jarvis-generated summaries of the prior month.
-- One row per (user, year, month). Surfaces on Home for ~5 days into the
-- new month, then quiets.

CREATE TABLE IF NOT EXISTS public.monthly_retros (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  year          INT NOT NULL,
  month         INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  summary       TEXT NOT NULL,
  highlights    TEXT,           -- bulleted highlights (newline-separated)
  lowlights     TEXT,           -- bulleted misses / drift
  next_focus    TEXT,           -- one-sentence forward pointer
  dismissed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_retros_user_period
  ON public.monthly_retros(user_id, year DESC, month DESC);

ALTER TABLE public.monthly_retros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monthly_retros_own" ON public.monthly_retros;
CREATE POLICY "monthly_retros_own" ON public.monthly_retros FOR ALL USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='monthly_retros') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_retros;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 0026_aesthetic_photos_bucket.sql
-- ──────────────────────────────────────────────────────────
-- Storage bucket for aesthetic check-in photos.
--
-- Bucket is PRIVATE. Object paths are namespaced by user_id so RLS can
-- restrict access per-user without exposing other users' photos.
--
-- Object path convention: `${user_id}/${YYYY-MM-DD}_${angle}_${rand}.${ext}`
-- e.g.  `abc-123/2026-05-16_front_x7k.jpg`

-- Create the bucket if it doesn't exist (idempotent via DO block).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'aesthetic-photos') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('aesthetic-photos', 'aesthetic-photos', false, 10485760,
            ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']);
  END IF;
END $$;

-- RLS policies — owner can read/write their own object path prefix.
-- storage.objects has bucket_id + name (path). We split path on '/' and
-- compare the first segment to auth.uid().

DROP POLICY IF EXISTS "aesthetic_photos_read_own"   ON storage.objects;
DROP POLICY IF EXISTS "aesthetic_photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "aesthetic_photos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "aesthetic_photos_delete_own" ON storage.objects;

CREATE POLICY "aesthetic_photos_read_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'aesthetic-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "aesthetic_photos_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'aesthetic-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "aesthetic_photos_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'aesthetic-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "aesthetic_photos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'aesthetic-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ──────────────────────────────────────────────────────────
-- 0027_businesses.sql
-- ──────────────────────────────────────────────────────────
-- 0027_businesses.sql
-- Businesses portfolio. Each business is an entity (not just a goal), with
-- status / stage / MRR / customers tracked over time. Revenue log keeps a
-- daily history so we can compute MoM growth and surface trend in the
-- snapshot.
--
-- Statuses follow startup-stage convention: idea → building → live →
-- growing → paused. archived_at handles wound-down without polluting the
-- status enum.

create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  status          text not null default 'idea'
                  check (status in ('idea','building','live','growing','paused')),
  category        text,
  monthly_revenue numeric default 0 check (monthly_revenue >= 0),
  customer_count  integer default 0 check (customer_count >= 0),
  next_action     text,
  notes           text,
  started_at      date,
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists businesses_user_archived_idx
  on public.businesses(user_id, archived_at);

create table if not exists public.business_revenue_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount      numeric not null,
  log_date    date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists business_revenue_log_user_biz_date_idx
  on public.business_revenue_log(user_id, business_id, log_date desc);

alter table public.businesses              enable row level security;
alter table public.business_revenue_log    enable row level security;

drop policy if exists "own businesses"        on public.businesses;
drop policy if exists "own business revenue"  on public.business_revenue_log;

create policy "own businesses" on public.businesses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own business revenue" on public.business_revenue_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime so UI tiles update across tabs / devices live. Wrapped in
-- exception-handling DO blocks because ALTER PUBLICATION ADD TABLE
-- lacks IF NOT EXISTS — without this the second run errors with
-- "42710: relation already member of publication."
do $$ begin alter publication supabase_realtime add table public.businesses;           exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.business_revenue_log; exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────
-- 0028_business_agents.sql
-- ──────────────────────────────────────────────────────────
-- 0028_business_agents.sql
-- Per-business agent workforce. Each business can have one or more agent
-- roles assigned to it. The actual agent definitions live on Sir's
-- machine at .claude/agents/<name>.md (managed via Jarvis's
-- cc_define_agent tool). This table is the dashboard's link layer —
-- "what's assigned to which business, and when did it last run."
--
-- When Sir taps Run on an assigned agent, the dashboard opens Jarvis HUD
-- with a pre-formed deploy prompt that includes the business's current
-- context (name, status, MRR, next_action) so the agent runs grounded
-- in real state, not generic instructions.

create table if not exists public.business_agents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  agent_name      text,                  -- matches .claude/agents/<name>.md; null = generic / pending define
  role_label      text not null,         -- display ("Competitor watcher")
  purpose         text,                  -- one-line description of what the agent does
  last_run_at     timestamptz,
  last_session_id text,                  -- session id returned by cc_run_agent
  created_at      timestamptz not null default now()
);

create index if not exists business_agents_user_biz_idx
  on public.business_agents(user_id, business_id);

alter table public.business_agents enable row level security;

drop policy if exists "own business agents" on public.business_agents;
create policy "own business agents" on public.business_agents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ begin alter publication supabase_realtime add table public.business_agents; exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────
-- 0029_artifacts_to_businesses.sql
-- ──────────────────────────────────────────────────────────
-- 0029_artifacts_to_businesses.sql
-- Wire jarvis_artifacts back to the business that produced them. Each
-- artifact can be optionally tagged with the business it belongs to and
-- the specific agent role that authored it. With this in place,
-- BusinessDetail can surface "Competitor watcher · 2h ago — <artifact>"
-- inline so the agents stop feeling like fire-and-forget.
--
-- Both columns are nullable — legacy artifacts and one-off Jarvis writes
-- that aren't business-scoped continue to work unchanged.

alter table public.jarvis_artifacts
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

alter table public.jarvis_artifacts
  add column if not exists business_agent_id uuid references public.business_agents(id) on delete set null;

create index if not exists jarvis_artifacts_business_idx
  on public.jarvis_artifacts(business_id, created_at desc)
  where business_id is not null;

create index if not exists jarvis_artifacts_business_agent_idx
  on public.jarvis_artifacts(business_agent_id, created_at desc)
  where business_agent_id is not null;

-- ──────────────────────────────────────────────────────────
-- 0030_business_tasks.sql
-- ──────────────────────────────────────────────────────────
-- 0030_business_tasks.sql
-- Business tasks. The control-panel surface for "what am I doing on this
-- business" — replaces the single-field `next_action` text on businesses
-- with a real checklist. Each business can have many tasks; UI shows
-- incomplete first, sorted by priority then created_at.
--
-- Migration auto-imports existing `businesses.next_action` values as the
-- first task on businesses that don't have tasks yet, so no historical
-- "next thing" gets stranded. The next_action column stays in the schema
-- (no DROP) for safety + so the AI context layer can fall back if needed.

create table if not exists public.business_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  title        text not null,
  is_complete  boolean not null default false,
  completed_at timestamptz,
  due_date     date,
  priority     int  not null default 0  check (priority in (-1, 0, 1)),  -- -1=low, 0=normal, 1=high
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists business_tasks_user_biz_open_idx
  on public.business_tasks(user_id, business_id, is_complete, priority desc, created_at);

alter table public.business_tasks enable row level security;

drop policy if exists "own business tasks" on public.business_tasks;
create policy "own business tasks" on public.business_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ begin alter publication supabase_realtime add table public.business_tasks; exception when duplicate_object then null; end $$;

-- Auto-import existing next_action text into a first task per business.
-- Idempotent: skips businesses that already have any task rows.
insert into public.business_tasks (user_id, business_id, title)
select b.user_id, b.id, b.next_action
from   public.businesses b
where  b.next_action is not null
  and  trim(b.next_action) <> ''
  and  not exists (select 1 from public.business_tasks t where t.business_id = b.id);

-- ──────────────────────────────────────────────────────────
-- 0031_business_agents_schedule.sql
-- ──────────────────────────────────────────────────────────
-- 0031_business_agents_schedule.sql
-- Per-agent scheduling. Each business_agent can optionally run on a
-- cadence — daily / weekly / monthly at a fixed hour (and weekday or
-- day-of-month). A Vercel Cron endpoint hits the dispatch API every
-- ~5 min, finds agents whose next_run_at has passed, and inserts a
-- jarvis_cc_dispatches row. The bridge daemon on Sir's Mac picks it up
-- the next time it's online and runs `claude --bg --agent <name>` with
-- the business context, exactly the same path as a manual Run tap.
--
-- next_run_at is the canonical "when is this due" timestamp. The cron
-- endpoint queries by `next_run_at <= now() AND schedule_kind != 'none'`
-- and bumps next_run_at after dispatching. Recomputation logic lives
-- server-side so the schema stays simple (no Postgres-side cron math).

alter table public.business_agents
  add column if not exists schedule_kind text not null default 'none'
    check (schedule_kind in ('none', 'daily', 'weekly', 'monthly'));

alter table public.business_agents
  add column if not exists schedule_hour int default 9
    check (schedule_hour is null or (schedule_hour >= 0 and schedule_hour <= 23));

alter table public.business_agents
  add column if not exists schedule_dow int default 1
    check (schedule_dow is null or (schedule_dow >= 0 and schedule_dow <= 6));   -- 0=Sun, 6=Sat

alter table public.business_agents
  add column if not exists schedule_dom int default 1
    check (schedule_dom is null or (schedule_dom >= 1 and schedule_dom <= 28));  -- cap at 28 to avoid Feb edge cases

alter table public.business_agents
  add column if not exists next_run_at timestamptz;

-- Cron queries by (schedule_kind, next_run_at). Index keeps the lookup
-- O(log N) instead of O(N) once Sir has a handful of scheduled agents
-- across many businesses.
create index if not exists business_agents_schedule_due_idx
  on public.business_agents(schedule_kind, next_run_at)
  where schedule_kind <> 'none';

-- ──────────────────────────────────────────────────────────
-- 0032_marketing_experiments.sql
-- ──────────────────────────────────────────────────────────
-- 0032_marketing_experiments.sql
-- Marketing experiments. The closed-loop layer that makes content/agents
-- "get smarter over time" — every variant gets logged with its outcome
-- (impressions, clicks, conversions, attributed revenue). When agents
-- dispatch on a business, the deploy prompt now includes the recent
-- experiment history + outcomes, so the next round of drafts is grounded
-- in what's actually converting for Sir's audience instead of generic
-- best practices.
--
-- business_id is nullable — supports pre-business experiments + cross-
-- business / personal-brand campaigns. channel is free-text so it works
-- for any platform without a hard-coded enum drifting out of date.
-- All metrics are nullable so logging a draft variant before posting
-- (or before metrics come in) is the natural flow.

create table if not exists public.marketing_experiments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  business_id         uuid references public.businesses(id) on delete set null,
  variant_label       text not null,                     -- "Hook A", "Subject line v2"
  variant_text        text not null,                     -- the actual content
  channel             text not null,                     -- twitter / linkedin / newsletter / cold_email / landing / etc
  posted_at           timestamptz,                       -- nullable: drafts haven't shipped yet
  link                text,                              -- URL to the live post if applicable
  notes               text,                              -- post-mortem notes
  -- Outcomes — nullable, fill in as data comes in
  impressions         integer check (impressions is null or impressions >= 0),
  clicks              integer check (clicks      is null or clicks      >= 0),
  conversions         integer check (conversions is null or conversions >= 0),
  revenue_attributed  numeric check (revenue_attributed is null or revenue_attributed >= 0),
  archived_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists marketing_experiments_user_biz_posted_idx
  on public.marketing_experiments(user_id, business_id, posted_at desc)
  where archived_at is null;

alter table public.marketing_experiments enable row level security;

drop policy if exists "own marketing experiments" on public.marketing_experiments;
create policy "own marketing experiments" on public.marketing_experiments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ begin alter publication supabase_realtime add table public.marketing_experiments; exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────
-- 0033_linked_chats.sql
-- ──────────────────────────────────────────────────────────
-- 0033_linked_chats.sql
-- Linked chats — external AI conversation references attached to a
-- business or a long-term goal. Sir often has Claude.ai (or ChatGPT)
-- conversations doing the heavy lifting on a specific business or
-- goal (pricing research, protocol design, deep brainstorms). Without
-- this layer those conversations live in a different app and get lost
-- from the dashboard's view. With it, the conversation is one tap
-- away from the surface it's actually about.
--
-- business_id and goal_id are both nullable + independent — most rows
-- will reference exactly one, but allowing both means a chat that
-- spans a business AND a personal goal can link to both. source is
-- free-text-ish but constrained to the common cases so the UI can
-- show appropriate icons.

create table if not exists public.linked_chats (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  url          text,
  source       text not null default 'claude'
                check (source in ('claude','chatgpt','jarvis','other')),
  summary      text,
  business_id  uuid references public.businesses(id)        on delete set null,
  goal_id      uuid references public.long_term_goals(id)   on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists linked_chats_user_business_idx
  on public.linked_chats(user_id, business_id, created_at desc)
  where archived_at is null and business_id is not null;

create index if not exists linked_chats_user_goal_idx
  on public.linked_chats(user_id, goal_id, created_at desc)
  where archived_at is null and goal_id is not null;

alter table public.linked_chats enable row level security;

drop policy if exists "own linked chats" on public.linked_chats;
create policy "own linked chats" on public.linked_chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ begin alter publication supabase_realtime add table public.linked_chats; exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────
-- 0034_finances.sql
-- ──────────────────────────────────────────────────────────
-- 0034_finances.sql
-- Finances tab foundation. Two tables:
--
--   wishlist_items       — "products to buy" list. Each item can
--                          optionally link back to a goal_id and/or
--                          business_id (the source that "assigned"
--                          the want). kind distinguishes leverage
--                          (tools that compound — laptop, software,
--                          equipment that produces income) from
--                          consumption (lifestyle / wants). The
--                          asymmetry is load-bearing: Sir's directive
--                          is "rich, not wannabe entrepreneur," so
--                          the system should call out when
--                          consumption outpaces leverage.
--
--   net_worth_snapshots  — monthly point-in-time entry of cash,
--                          investments, business_equity, debts. ONE
--                          row per month (unique constraint). Manual
--                          entry — Sir reads the cash number off
--                          ChatGPT/his bank and types it here.
--                          Rowan's job is the trajectory + the
--                          strategic context, not the aggregation.
--
-- Both are deliberately strategy-layer surfaces. Per Sir's
-- direction: don't compete with ChatGPT on bank linking; own the
-- decisions ChatGPT can't make because it doesn't see his
-- businesses + goals + life data.

create table if not exists public.wishlist_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  goal_id      uuid references public.long_term_goals(id) on delete set null,
  business_id  uuid references public.businesses(id)      on delete set null,
  title        text not null,
  url          text,
  price        numeric check (price is null or price >= 0),
  kind         text not null default 'consumption'
                check (kind in ('leverage','consumption')),
  priority     int  not null default 0 check (priority in (-1, 0, 1)),
  status       text not null default 'wanted'
                check (status in ('wanted','bought','dismissed')),
  notes        text,
  category     text,
  bought_at    timestamptz,
  cost_actual  numeric check (cost_actual is null or cost_actual >= 0),
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists wishlist_items_user_status_idx
  on public.wishlist_items(user_id, status, priority desc, created_at)
  where archived_at is null;
create index if not exists wishlist_items_user_goal_idx
  on public.wishlist_items(user_id, goal_id)
  where archived_at is null and goal_id is not null;
create index if not exists wishlist_items_user_business_idx
  on public.wishlist_items(user_id, business_id)
  where archived_at is null and business_id is not null;

alter table public.wishlist_items enable row level security;
drop policy if exists "own wishlist items" on public.wishlist_items;
create policy "own wishlist items" on public.wishlist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
do $$ begin alter publication supabase_realtime add table public.wishlist_items; exception when duplicate_object then null; end $$;

create table if not exists public.net_worth_snapshots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  snapshot_date   date not null,                          -- typically 1st of month
  cash            numeric default 0 check (cash             >= 0),
  investments     numeric default 0 check (investments      >= 0),
  business_equity numeric default 0 check (business_equity  >= 0),
  debts           numeric default 0 check (debts            >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists net_worth_snapshots_user_date_idx
  on public.net_worth_snapshots(user_id, snapshot_date desc);

alter table public.net_worth_snapshots enable row level security;
drop policy if exists "own net worth" on public.net_worth_snapshots;
create policy "own net worth" on public.net_worth_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
do $$ begin alter publication supabase_realtime add table public.net_worth_snapshots; exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────
-- 0035_goals_business_link.sql
-- ──────────────────────────────────────────────────────────
-- 0035_goals_business_link.sql
-- Goals should live UNDER a specific business, not float in a generic
-- "business bucket" pool. Adds an optional business_id link on
-- long_term_goals. Existing business-bucket goals get left with
-- business_id = NULL (no automatic backfill — Sir picks which business
-- each one belongs to via the goal widget). On business deletion the
-- goal stays but unlinks (SET NULL) so Sir can re-home it.
--
-- bucket column stays as-is — it's still the personal/business divide.
-- business_id is the FINER scoping inside the business bucket.

alter table public.long_term_goals
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

create index if not exists long_term_goals_business_idx
  on public.long_term_goals(business_id)
  where business_id is not null and is_active = true;
