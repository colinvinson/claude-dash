-- Goals tab — Life + Businesses sub-tab structure.
-- Replaces the half-finished Business tab with a unified bucketed goals surface.
--
-- This migration is SELF-SUFFICIENT: it creates `long_term_goals` from scratch
-- if migration 0002 was never applied, so you can run it standalone.

-- 1. Ensure the base table exists with all the original columns. No-op if 0002
--    was already applied.
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

-- RLS — idempotent (safe to re-run).
ALTER TABLE public.long_term_goals ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'long_term_goals' AND policyname = 'ltgoals_own'
  ) THEN
    CREATE POLICY "ltgoals_own" ON public.long_term_goals FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Wipe + restart: archive all existing rows. NOOP if the table was just created above.
UPDATE public.long_term_goals SET is_active = false;

-- 3. Add the new columns the Goals tab needs.
ALTER TABLE public.long_term_goals
  ADD COLUMN IF NOT EXISTS bucket                TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS current_state         TEXT,
  ADD COLUMN IF NOT EXISTS next_steps            TEXT,
  ADD COLUMN IF NOT EXISTS metrics               JSONB,
  ADD COLUMN IF NOT EXISTS sort_order            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_summary            TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ;

-- Constrain bucket to the two values the UI uses. CHECK added in a separate
-- block so re-running this migration doesn't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'long_term_goals_bucket_check'
  ) THEN
    ALTER TABLE public.long_term_goals
      ADD CONSTRAINT long_term_goals_bucket_check CHECK (bucket IN ('personal', 'business'));
  END IF;
END $$;

-- 4. Routine → goal linkage. Lets the widget compute progress from adherence.
ALTER TABLE public.supplement_stack
  ADD COLUMN IF NOT EXISTS linked_goal_id UUID REFERENCES public.long_term_goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplement_stack_linked_goal
  ON public.supplement_stack(linked_goal_id)
  WHERE linked_goal_id IS NOT NULL;

-- 5. Active-goal lookups should be fast even with years of archived rows.
CREATE INDEX IF NOT EXISTS idx_long_term_goals_active_bucket
  ON public.long_term_goals(user_id, bucket, sort_order)
  WHERE is_active = true;
