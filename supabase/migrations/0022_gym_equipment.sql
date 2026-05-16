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
