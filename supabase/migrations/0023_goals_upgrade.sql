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
