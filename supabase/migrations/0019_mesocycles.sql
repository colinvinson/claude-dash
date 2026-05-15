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
