-- ============================================================
-- Rowan Dashboard — Jarvis artifacts
-- Outputs that workers (or Jarvis directly) produce: blog posts,
-- plans, reports, market research, anything. Each artifact is text
-- + a name + a type tag so the UI can render it appropriately.
-- Run in Supabase SQL Editor after 0008.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.jarvis_artifacts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT DEFAULT 'markdown',         -- 'markdown' | 'text' | 'json' | 'html'
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.jarvis_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artifacts_own" ON public.jarvis_artifacts FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_artifacts_user ON public.jarvis_artifacts (user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.jarvis_artifacts;
