-- ============================================================
-- Rowan Dashboard — Redesign Tables
-- Paste into Supabase SQL Editor and run.
-- ============================================================

-- DAILY CONTEXT (morning check-in, one per day)
CREATE TABLE IF NOT EXISTS public.daily_context (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date   DATE NOT NULL,
  raw_text   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, log_date)
);
ALTER TABLE public.daily_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctx_own" ON public.daily_context FOR ALL USING (auth.uid() = user_id);

-- WATER LOGS (upsert daily glass count)
CREATE TABLE IF NOT EXISTS public.water_logs (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date   DATE NOT NULL,
  glasses    INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, log_date)
);
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "water_own" ON public.water_logs FOR ALL USING (auth.uid() = user_id);

-- ALCOHOL LOGS
CREATE TABLE IF NOT EXISTS public.alcohol_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date    DATE NOT NULL,
  drink_type  TEXT NOT NULL DEFAULT 'beer',
  drink_count INT NOT NULL DEFAULT 1,
  logged_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.alcohol_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alcohol_own" ON public.alcohol_logs FOR ALL USING (auth.uid() = user_id);

-- FAITH LOGS (upsert daily)
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
ALTER TABLE public.faith_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faith_own" ON public.faith_logs FOR ALL USING (auth.uid() = user_id);

-- MOOD LOGS
CREATE TABLE IF NOT EXISTS public.mood_logs (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date  DATE NOT NULL,
  score     INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  logged_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mood_own" ON public.mood_logs FOR ALL USING (auth.uid() = user_id);

-- WEIGHT LOGS
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weight_own" ON public.weight_logs FOR ALL USING (auth.uid() = user_id);

-- JOURNAL ENTRIES (brain dump)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content    TEXT NOT NULL,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_own" ON public.journal_entries FOR ALL USING (auth.uid() = user_id);

-- LONG-TERM GOALS
CREATE TABLE IF NOT EXISTS public.long_term_goals (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title          TEXT NOT NULL,
  category       TEXT DEFAULT 'general',
  target_date    DATE,
  ai_action_plan TEXT,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.long_term_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ltgoals_own" ON public.long_term_goals FOR ALL USING (auth.uid() = user_id);

-- Enable realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_context;
ALTER PUBLICATION supabase_realtime ADD TABLE public.water_logs;
