-- ============================================================
-- Rowan Dashboard — Protein Logger
-- One row per logged food. Only protein is persisted — the score
-- is metadata for trend analysis, not a multi-macro tracker.
-- Run in Supabase SQL Editor after 0004.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.protein_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date     DATE NOT NULL,
  protein_g    NUMERIC NOT NULL,
  food_name    TEXT,
  source       TEXT NOT NULL,    -- 'manual' | 'photo' | 'barcode'
  ai_score     INT,               -- 0-100 muscle-mass suitability (nullable for manual-only)
  ai_reasoning TEXT,              -- one-line "why this score"
  barcode      TEXT,
  logged_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.protein_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "protein_own" ON public.protein_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_protein_logs_user_date ON public.protein_logs (user_id, log_date);

ALTER PUBLICATION supabase_realtime ADD TABLE public.protein_logs;
