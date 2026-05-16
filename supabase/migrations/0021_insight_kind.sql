-- Tag jarvis_insights rows by kind so background detectors (e.g. the
-- daily personal-best detector) can dedupe within a day without scanning
-- every insight's text.
ALTER TABLE public.jarvis_insights
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general';
CREATE INDEX IF NOT EXISTS idx_insights_user_kind_date
  ON public.jarvis_insights(user_id, kind, triggered_at DESC);
