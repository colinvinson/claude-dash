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
