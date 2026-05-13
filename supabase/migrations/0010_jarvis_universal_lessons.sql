-- ============================================================
-- Rowan Dashboard — Universal worker lessons
-- Lessons that apply to ALL workers (current + future), not just
-- the one that learned them. Mostly craft principles:
-- "verify scraped data before writing artifacts", "cite sources",
-- "if an API fails, log + continue rather than crash", etc.
-- Run in Supabase SQL Editor after 0009.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.jarvis_universal_lessons (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson           TEXT NOT NULL,
  origin_worker_id UUID REFERENCES public.jarvis_workers(id) ON DELETE SET NULL,
  origin_run_id    UUID REFERENCES public.jarvis_worker_runs(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.jarvis_universal_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "univ_lessons_own" ON public.jarvis_universal_lessons FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_univ_lessons_user
  ON public.jarvis_universal_lessons (user_id, created_at DESC);
-- Dedupe at app level via case-insensitive exact match; index supports lookup
CREATE INDEX IF NOT EXISTS idx_jarvis_univ_lessons_lookup
  ON public.jarvis_universal_lessons (user_id, lower(lesson));
