-- ============================================================
-- Rowan Dashboard — Coach Extensions
-- Adds:
--   - morning_briefings: one row per day, AI-generated 3-sentence brief
--   - weekly_reviews: one row per week (Sunday), longer AI-written letter
--   - goal_templates: recurring goals that auto-populate each day
-- Run in Supabase SQL Editor after 0005.
-- ============================================================

-- Daily morning briefing
CREATE TABLE IF NOT EXISTS public.morning_briefings (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date   DATE NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, log_date)
);
ALTER TABLE public.morning_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefing_own" ON public.morning_briefings FOR ALL USING (auth.uid() = user_id);

-- Weekly review letter
CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  body       TEXT NOT NULL,
  highlights JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_own" ON public.weekly_reviews FOR ALL USING (auth.uid() = user_id);

-- Recurring goal templates (auto-populated each day)
CREATE TABLE IF NOT EXISTS public.goal_templates (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title      TEXT NOT NULL,
  priority   INT DEFAULT 1,
  is_active  BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.goal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tmpl_own" ON public.goal_templates FOR ALL USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.morning_briefings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_reviews;
