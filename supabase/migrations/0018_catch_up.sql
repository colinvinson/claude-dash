-- ============================================================
-- Rowan Dashboard — Catch-up migration
-- ============================================================
-- Brings any Supabase project up to the full current schema regardless of
-- which earlier migrations were skipped. Every statement is IDEMPOTENT — safe
-- to run repeatedly, safe to run if you've applied every prior migration,
-- safe to run if you've applied none.
--
-- What this does:
--   1. Creates every active table with its FINAL column set (no-op if it
--      already exists with the right shape).
--   2. ADD COLUMN IF NOT EXISTS for every column added by migrations 0003-0017,
--      catching tables that exist but with older column sets.
--   3. Renames overseer_messages → jarvis_messages / overseer_insights →
--      jarvis_insights only if the rename hasn't already happened.
--   4. DROP IF EXISTS for the four obsolete tables (jarvis_workers,
--      jarvis_worker_runs, jarvis_universal_lessons, jarvis_conversations).
--   5. Idempotent RLS + policy setup (DROP POLICY IF EXISTS then CREATE).
--   6. Indexes via CREATE INDEX IF NOT EXISTS.
--   7. Realtime publication memberships via DO blocks that check pg_publication_tables.

-- ────────────────────────────────────────────────────────────
-- 0. Auth trigger (from 0001)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (new.id) ON CONFLICT DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 1. Pre-flight rename (overseer → jarvis)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='overseer_messages')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='jarvis_messages') THEN
    ALTER TABLE public.overseer_messages RENAME TO jarvis_messages;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='overseer_insights')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='jarvis_insights') THEN
    ALTER TABLE public.overseer_insights RENAME TO jarvis_insights;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Tables — CREATE TABLE IF NOT EXISTS with FINAL columns
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  timezone        TEXT DEFAULT 'Europe/Zurich',
  wake_time       TIME DEFAULT '08:00',
  goal_weight_kg  NUMERIC,
  training_goal   TEXT DEFAULT 'hypertrophy',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goals (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        TEXT NOT NULL,
  goal_date    DATE NOT NULL,
  is_complete  BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  priority     INT DEFAULT 1,
  pushed_from  DATE,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goal_streaks (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_streak     INT DEFAULT 0,
  longest_streak     INT DEFAULT 0,
  last_complete_date DATE,
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.goal_templates (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title      TEXT NOT NULL,
  priority   INT DEFAULT 1,
  is_active  BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.long_term_goals (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title                 TEXT NOT NULL,
  category              TEXT DEFAULT 'general',
  target_date           DATE,
  ai_action_plan        TEXT,
  is_active             BOOLEAN DEFAULT true,
  bucket                TEXT NOT NULL DEFAULT 'personal',
  current_state         TEXT,
  next_steps            TEXT,
  metrics               JSONB,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  ai_summary            TEXT,
  ai_summary_updated_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplement_stack (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  dose            TEXT,
  timing          TEXT,
  notes           TEXT,
  cutoff_time     TIME,
  category        TEXT NOT NULL DEFAULT 'supplement',
  scheduled_at    TIME,
  duration_min    INTEGER,
  icon            TEXT,
  color           TEXT,
  days_of_week    INTEGER[],
  linked_goal_id  UUID REFERENCES public.long_term_goals(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplement_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  supplement_id UUID REFERENCES public.supplement_stack(id) ON DELETE CASCADE NOT NULL,
  log_date      DATE NOT NULL,
  taken_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medication_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  medication_type TEXT NOT NULL,
  log_date        DATE NOT NULL,
  taken_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gym_locations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exercises (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gym_id         UUID REFERENCES public.gym_locations(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  muscle_group   TEXT,
  split_day      TEXT,
  exercise_type  TEXT DEFAULT 'Secondary',
  muscle_targets TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_sets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  gym_id      UUID REFERENCES public.gym_locations(id) ON DELETE SET NULL,
  split_day   TEXT,
  weight_kg   NUMERIC NOT NULL,
  reps        INT NOT NULL,
  rpe         INT CHECK (rpe BETWEEN 6 AND 10),
  est_1rm     NUMERIC,
  log_date    DATE NOT NULL,
  logged_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_logs (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date                 DATE NOT NULL,
  readiness_score      INT,
  readiness_label      TEXT,
  sleep_score          INT,
  sleep_hours          NUMERIC,
  activity_score       INT,
  hrv                  INT,
  rhr                  INT,
  spo2_pct             NUMERIC,
  resp_rate            NUMERIC,
  skin_temp_delta      NUMERIC,
  rem_min              INT,
  deep_min             INT,
  light_min            INT,
  awake_min            INT,
  stress_high_sec      INT,
  recovery_high_sec    INT,
  stress_day_summary   TEXT,
  resilience_level     TEXT,
  vo2_max              NUMERIC,
  oura_workouts        JSONB,
  todays_call_body     TEXT,
  todays_call_severity TEXT DEFAULT 'green',
  is_final             BOOLEAN DEFAULT false,
  raw_oura_json        JSONB,
  created_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.daily_context (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date   DATE NOT NULL,
  raw_text   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, log_date)
);

CREATE TABLE IF NOT EXISTS public.water_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date   DATE NOT NULL,
  glasses    INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, log_date)
);

CREATE TABLE IF NOT EXISTS public.alcohol_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date    DATE NOT NULL,
  drink_type  TEXT NOT NULL DEFAULT 'beer',
  drink_count INT NOT NULL DEFAULT 1,
  logged_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.faith_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date        DATE NOT NULL,
  prayed          BOOLEAN DEFAULT false,
  bible_min       INT DEFAULT 0,
  church_attended BOOLEAN DEFAULT false,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, log_date)
);

CREATE TABLE IF NOT EXISTS public.mood_logs (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date  DATE NOT NULL,
  score     INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  logged_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.weight_logs (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meditation_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date     DATE NOT NULL,
  duration_min INT NOT NULL,
  logged_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content    TEXT NOT NULL,
  ai_summary TEXT,
  category   TEXT NOT NULL DEFAULT 'personal',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.protein_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date     DATE NOT NULL,
  protein_g    NUMERIC NOT NULL,
  food_name    TEXT,
  source       TEXT NOT NULL,
  ai_score     INT,
  ai_reasoning TEXT,
  barcode      TEXT,
  logged_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.morning_briefings (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date   DATE NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, log_date)
);

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  body       TEXT NOT NULL,
  highlights JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.jarvis_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jarvis_insights (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  body         TEXT NOT NULL,
  severity     TEXT DEFAULT 'green',
  dismissed_at TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jarvis_facts (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fact               TEXT NOT NULL,
  source             TEXT NOT NULL,
  confidence         NUMERIC DEFAULT 0.8,
  last_referenced_at TIMESTAMPTZ,
  superseded_at      TIMESTAMPTZ,
  superseded_by      UUID REFERENCES public.jarvis_facts(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jarvis_artifacts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT DEFAULT 'markdown',
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jarvis_cc_dispatches (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind         TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending',
  result       JSONB,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service_name  TEXT NOT NULL,
  amount        NUMERIC NOT NULL,
  currency      TEXT DEFAULT 'USD',
  billing_cycle TEXT DEFAULT 'Monthly',
  next_renewal  DATE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.budget_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label      TEXT NOT NULL,
  amount_chf NUMERIC NOT NULL,
  category   TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incoming_orders (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_name   TEXT NOT NULL,
  arrived_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 3. ADD COLUMN IF NOT EXISTS — back-fills for tables that
--    existed before later migrations added columns.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS training_goal  TEXT DEFAULT 'hypertrophy';

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS exercise_type  TEXT DEFAULT 'Secondary',
  ADD COLUMN IF NOT EXISTS muscle_targets TEXT[] DEFAULT '{}';

ALTER TABLE public.workout_sets
  ADD COLUMN IF NOT EXISTS rpe INT;

ALTER TABLE public.health_logs
  ADD COLUMN IF NOT EXISTS stress_high_sec    INT,
  ADD COLUMN IF NOT EXISTS recovery_high_sec  INT,
  ADD COLUMN IF NOT EXISTS stress_day_summary TEXT,
  ADD COLUMN IF NOT EXISTS resilience_level   TEXT,
  ADD COLUMN IF NOT EXISTS vo2_max            NUMERIC,
  ADD COLUMN IF NOT EXISTS oura_workouts      JSONB;

ALTER TABLE public.supplement_stack
  ADD COLUMN IF NOT EXISTS category       TEXT NOT NULL DEFAULT 'supplement',
  ADD COLUMN IF NOT EXISTS scheduled_at   TIME,
  ADD COLUMN IF NOT EXISTS duration_min   INTEGER,
  ADD COLUMN IF NOT EXISTS icon           TEXT,
  ADD COLUMN IF NOT EXISTS color          TEXT,
  ADD COLUMN IF NOT EXISTS days_of_week   INTEGER[],
  ADD COLUMN IF NOT EXISTS linked_goal_id UUID REFERENCES public.long_term_goals(id) ON DELETE SET NULL;

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'personal';

ALTER TABLE public.long_term_goals
  ADD COLUMN IF NOT EXISTS bucket                TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS current_state         TEXT,
  ADD COLUMN IF NOT EXISTS next_steps            TEXT,
  ADD COLUMN IF NOT EXISTS metrics               JSONB,
  ADD COLUMN IF NOT EXISTS sort_order            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_summary            TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ;

ALTER TABLE public.jarvis_facts
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.jarvis_facts(id) ON DELETE SET NULL;

-- long_term_goals.bucket CHECK constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='long_term_goals_bucket_check') THEN
    ALTER TABLE public.long_term_goals
      ADD CONSTRAINT long_term_goals_bucket_check CHECK (bucket IN ('personal','business'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. Drop obsolete tables (from 0015)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.jarvis_worker_runs        CASCADE;
DROP TABLE IF EXISTS public.jarvis_universal_lessons  CASCADE;
DROP TABLE IF EXISTS public.jarvis_workers            CASCADE;
DROP TABLE IF EXISTS public.jarvis_conversations      CASCADE;

-- ────────────────────────────────────────────────────────────
-- 5. RLS + policies — drop-and-create for idempotency
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_streaks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.long_term_goals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_stack      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_context         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alcohol_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faith_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meditation_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protein_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morning_briefings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_insights       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_facts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_artifacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jarvis_cc_dispatches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_orders       ENABLE ROW LEVEL SECURITY;

-- Generic helper: drop existing policy by name, then create.
-- All policies follow the same "own this row by user_id" pattern except
-- profiles (id = auth.uid()).
DROP POLICY IF EXISTS "profiles_own"            ON public.profiles;
CREATE POLICY "profiles_own"                    ON public.profiles               FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "goals_own"               ON public.goals;
CREATE POLICY "goals_own"                       ON public.goals                  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "streaks_own"             ON public.goal_streaks;
CREATE POLICY "streaks_own"                     ON public.goal_streaks           FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tmpl_own"                ON public.goal_templates;
CREATE POLICY "tmpl_own"                        ON public.goal_templates         FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ltgoals_own"             ON public.long_term_goals;
CREATE POLICY "ltgoals_own"                     ON public.long_term_goals        FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "stack_own"               ON public.supplement_stack;
CREATE POLICY "stack_own"                       ON public.supplement_stack       FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "suplog_own"              ON public.supplement_logs;
CREATE POLICY "suplog_own"                      ON public.supplement_logs        FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "medlog_own"              ON public.medication_logs;
CREATE POLICY "medlog_own"                      ON public.medication_logs        FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "gyms_own"                ON public.gym_locations;
CREATE POLICY "gyms_own"                        ON public.gym_locations          FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "exercises_own"           ON public.exercises;
CREATE POLICY "exercises_own"                   ON public.exercises              FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sets_own"                ON public.workout_sets;
CREATE POLICY "sets_own"                        ON public.workout_sets           FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "health_own"              ON public.health_logs;
CREATE POLICY "health_own"                      ON public.health_logs            FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ctx_own"                 ON public.daily_context;
CREATE POLICY "ctx_own"                         ON public.daily_context          FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "water_own"               ON public.water_logs;
CREATE POLICY "water_own"                       ON public.water_logs             FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "alcohol_own"             ON public.alcohol_logs;
CREATE POLICY "alcohol_own"                     ON public.alcohol_logs           FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "faith_own"               ON public.faith_logs;
CREATE POLICY "faith_own"                       ON public.faith_logs             FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mood_own"                ON public.mood_logs;
CREATE POLICY "mood_own"                        ON public.mood_logs              FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "weight_own"              ON public.weight_logs;
CREATE POLICY "weight_own"                      ON public.weight_logs            FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "meditation_own"          ON public.meditation_logs;
CREATE POLICY "meditation_own"                  ON public.meditation_logs        FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "journal_own"             ON public.journal_entries;
CREATE POLICY "journal_own"                     ON public.journal_entries        FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "protein_own"             ON public.protein_logs;
CREATE POLICY "protein_own"                     ON public.protein_logs           FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "briefing_own"            ON public.morning_briefings;
CREATE POLICY "briefing_own"                    ON public.morning_briefings      FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "review_own"              ON public.weekly_reviews;
CREATE POLICY "review_own"                      ON public.weekly_reviews         FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "jarvis_messages_own"     ON public.jarvis_messages;
DROP POLICY IF EXISTS "msgs_own"                ON public.jarvis_messages;
CREATE POLICY "jarvis_messages_own"             ON public.jarvis_messages        FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "jarvis_insights_own"     ON public.jarvis_insights;
DROP POLICY IF EXISTS "insights_own"            ON public.jarvis_insights;
CREATE POLICY "jarvis_insights_own"             ON public.jarvis_insights        FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "facts_own"               ON public.jarvis_facts;
CREATE POLICY "facts_own"                       ON public.jarvis_facts           FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "artifacts_own"           ON public.jarvis_artifacts;
CREATE POLICY "artifacts_own"                   ON public.jarvis_artifacts       FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "dispatches_own"          ON public.jarvis_cc_dispatches;
CREATE POLICY "dispatches_own"                  ON public.jarvis_cc_dispatches   FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_own"  ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own"          ON public.push_subscriptions     FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subs_own"                ON public.subscriptions;
CREATE POLICY "subs_own"                        ON public.subscriptions          FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "budget_own"              ON public.budget_items;
CREATE POLICY "budget_own"                      ON public.budget_items           FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "orders_own"              ON public.incoming_orders;
CREATE POLICY "orders_own"                      ON public.incoming_orders        FOR ALL USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 6. Trigger on auth.users (idempotent)
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 7. Indexes
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS goals_user_date                ON public.goals(user_id, goal_date);
CREATE INDEX IF NOT EXISTS suplog_user_date               ON public.supplement_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS medlog_user_date               ON public.medication_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS meditation_user_date           ON public.meditation_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS sets_exercise                  ON public.workout_sets(exercise_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_protein_logs_user_date     ON public.protein_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_jarvis_facts_user          ON public.jarvis_facts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_facts_active        ON public.jarvis_facts(user_id, last_referenced_at DESC NULLS LAST, created_at DESC) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jarvis_artifacts_user      ON public.jarvis_artifacts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_dispatches_pending      ON public.jarvis_cc_dispatches(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user    ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_supplement_stack_scheduled ON public.supplement_stack(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_supplement_stack_linked_goal ON public.supplement_stack(linked_goal_id) WHERE linked_goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_long_term_goals_active_bucket ON public.long_term_goals(user_id, bucket, sort_order) WHERE is_active = true;

-- ────────────────────────────────────────────────────────────
-- 8. Realtime publication memberships (idempotent)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'goals','supplement_logs','medication_logs','meditation_logs','workout_sets',
    'health_logs','daily_context','water_logs','protein_logs','morning_briefings',
    'weekly_reviews','jarvis_messages','jarvis_facts','jarvis_artifacts','jarvis_cc_dispatches'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
