-- ============================================================
-- Rowan Dashboard — Initial Schema
-- Paste this entire file into Supabase SQL Editor and run it.
-- ============================================================

-- Auto-create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (new.id) ON CONFLICT DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  timezone    TEXT DEFAULT 'Europe/Zurich',
  wake_time   TIME DEFAULT '08:00',
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = id);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- GOALS
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
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_own" ON public.goals FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS goals_user_date ON public.goals(user_id, goal_date);

-- GOAL STREAKS
CREATE TABLE IF NOT EXISTS public.goal_streaks (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_streak     INT DEFAULT 0,
  longest_streak     INT DEFAULT 0,
  last_complete_date DATE,
  updated_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.goal_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streaks_own" ON public.goal_streaks FOR ALL USING (auth.uid() = user_id);

-- SUPPLEMENT STACK
CREATE TABLE IF NOT EXISTS public.supplement_stack (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  dose        TEXT,
  timing      TEXT,  -- 'Morning', 'Lunch', 'Evening'
  notes       TEXT,
  cutoff_time TIME,
  is_active   BOOLEAN DEFAULT true,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.supplement_stack ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stack_own" ON public.supplement_stack FOR ALL USING (auth.uid() = user_id);

-- SUPPLEMENT LOGS (daily, resets 6 AM)
CREATE TABLE IF NOT EXISTS public.supplement_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  supplement_id UUID REFERENCES public.supplement_stack(id) ON DELETE CASCADE NOT NULL,
  log_date      DATE NOT NULL,
  taken_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suplog_own" ON public.supplement_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS suplog_user_date ON public.supplement_logs(user_id, log_date);

-- MEDICATION LOGS (concerta + velo, resets 6 AM)
CREATE TABLE IF NOT EXISTS public.medication_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  medication_type TEXT NOT NULL,  -- 'concerta' | 'velo'
  log_date        DATE NOT NULL,
  taken_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medlog_own" ON public.medication_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS medlog_user_date ON public.medication_logs(user_id, log_date);

-- GYM LOCATIONS
CREATE TABLE IF NOT EXISTS public.gym_locations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.gym_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gyms_own" ON public.gym_locations FOR ALL USING (auth.uid() = user_id);

-- EXERCISES
CREATE TABLE IF NOT EXISTS public.exercises (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gym_id       UUID REFERENCES public.gym_locations(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  muscle_group TEXT,
  split_day    TEXT,  -- 'Push', 'Pull', 'Legs'
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises_own" ON public.exercises FOR ALL USING (auth.uid() = user_id);

-- WORKOUT SETS
CREATE TABLE IF NOT EXISTS public.workout_sets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  gym_id      UUID REFERENCES public.gym_locations(id) ON DELETE SET NULL,
  split_day   TEXT,
  weight_kg   NUMERIC NOT NULL,
  reps        INT NOT NULL,
  est_1rm     NUMERIC,
  log_date    DATE NOT NULL,
  logged_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sets_own" ON public.workout_sets FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS sets_exercise ON public.workout_sets(exercise_id, logged_at DESC);

-- OVERSEER MESSAGES
CREATE TABLE IF NOT EXISTS public.overseer_messages (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role       TEXT NOT NULL,  -- 'user' | 'assistant'
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.overseer_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msgs_own" ON public.overseer_messages FOR ALL USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.overseer_messages;

-- OVERSEER INSIGHTS (proactive analysis)
CREATE TABLE IF NOT EXISTS public.overseer_insights (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  body         TEXT NOT NULL,
  severity     TEXT DEFAULT 'green',  -- 'green' | 'yellow' | 'red'
  dismissed_at TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.overseer_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insights_own" ON public.overseer_insights FOR ALL USING (auth.uid() = user_id);

-- SUBSCRIPTIONS
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
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_own" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);

-- BUDGET ITEMS
CREATE TABLE IF NOT EXISTS public.budget_items (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label      TEXT NOT NULL,
  amount_chf NUMERIC NOT NULL,
  category   TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_own" ON public.budget_items FOR ALL USING (auth.uid() = user_id);

-- INCOMING ORDERS
CREATE TABLE IF NOT EXISTS public.incoming_orders (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_name   TEXT NOT NULL,
  arrived_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.incoming_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_own" ON public.incoming_orders FOR ALL USING (auth.uid() = user_id);

-- HEALTH LOGS (Oura Ring data, one row per day)
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
  todays_call_body     TEXT,
  todays_call_severity TEXT DEFAULT 'green',
  is_final             BOOLEAN DEFAULT false,
  raw_oura_json        JSONB,
  created_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_own" ON public.health_logs FOR ALL USING (auth.uid() = user_id);

-- MEDITATION LOGS
CREATE TABLE IF NOT EXISTS public.meditation_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date     DATE NOT NULL,
  duration_min INT NOT NULL,
  logged_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.meditation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meditation_own" ON public.meditation_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS meditation_user_date ON public.meditation_logs(user_id, log_date);

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplement_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medication_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meditation_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_sets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.health_logs;
