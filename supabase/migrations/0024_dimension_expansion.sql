-- Dimension expansion — make the dashboard see Sir's life in more dimensions
-- than just physical health + body comp. Per the app's mission ("feed
-- maximum info about Sir's self-improvement journey into one unified
-- dashboard so it can guide him in every aspect"), this migration adds
-- the 9 most-impactful missing tracking surfaces:
--
--   focus_sessions   — cognitive output / deep work
--   social_logs      — intentional connection time
--   cardio_logs      — HR-zone work (complements strength tracking)
--   libido_logs      — primary signal for hormone/relationship health
--   aesthetic_logs   — visual progress check-ins
--   caffeine_logs    — distinct from supplements; drives sleep/anxiety
--   sun_logs         — UV exposure (mood, vitamin D, tan goal)
--   learning_logs    — growth dimension
--   money_logs       — financial improvement
--
-- All tables follow the same shape: id, user_id, logged_at, log_date,
-- numeric/text fields specific to the dimension, RLS owns-own-data.

-- ── 1. Focus sessions ──
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  duration_min INT NOT NULL,
  project      TEXT,
  output       TEXT,
  rating       INT,   -- 1-5 quality of the session
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "focus_sessions_own" ON public.focus_sessions;
CREATE POLICY "focus_sessions_own" ON public.focus_sessions FOR ALL USING (auth.uid() = user_id);

-- ── 2. Social interactions ──
CREATE TABLE IF NOT EXISTS public.social_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_name  TEXT,
  kind          TEXT NOT NULL DEFAULT 'in-person', -- in-person | call | text | event
  quality       INT,                                -- 1-5 felt-good rating
  duration_min  INT,
  notes         TEXT,
  log_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.social_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_logs_own" ON public.social_logs;
CREATE POLICY "social_logs_own" ON public.social_logs FOR ALL USING (auth.uid() = user_id);

-- ── 3. Cardio sessions ──
CREATE TABLE IF NOT EXISTS public.cardio_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'zone2',  -- zone2 | hiit | walk | run | bike | row | other
  duration_min INT NOT NULL,
  distance_km  NUMERIC,
  hr_avg       INT,
  rpe          INT,                            -- 1-10 perceived effort
  notes        TEXT,
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cardio_logs_own" ON public.cardio_logs;
CREATE POLICY "cardio_logs_own" ON public.cardio_logs FOR ALL USING (auth.uid() = user_id);

-- ── 4. Libido / sexual health ──
CREATE TABLE IF NOT EXISTS public.libido_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 10),
  notes       TEXT,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.libido_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "libido_logs_own" ON public.libido_logs;
CREATE POLICY "libido_logs_own" ON public.libido_logs FOR ALL USING (auth.uid() = user_id);

-- ── 5. Aesthetic check-ins (photos / observations) ──
CREATE TABLE IF NOT EXISTS public.aesthetic_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  angle        TEXT,        -- front | back | side | flex | face
  rating       INT,         -- 1-10 how Sir feels about the look today
  notes        TEXT,
  photo_url    TEXT,        -- optional — Supabase Storage URL if added later
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.aesthetic_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aesthetic_logs_own" ON public.aesthetic_logs;
CREATE POLICY "aesthetic_logs_own" ON public.aesthetic_logs FOR ALL USING (auth.uid() = user_id);

-- ── 6. Caffeine ──
CREATE TABLE IF NOT EXISTS public.caffeine_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mg          INT NOT NULL,
  source      TEXT,        -- coffee | espresso | tea | preworkout | nicotine | etc.
  notes       TEXT,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.caffeine_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "caffeine_logs_own" ON public.caffeine_logs;
CREATE POLICY "caffeine_logs_own" ON public.caffeine_logs FOR ALL USING (auth.uid() = user_id);

-- ── 7. Sun exposure ──
CREATE TABLE IF NOT EXISTS public.sun_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  duration_min    INT NOT NULL,
  with_sunscreen  BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  log_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sun_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sun_logs_own" ON public.sun_logs;
CREATE POLICY "sun_logs_own" ON public.sun_logs FOR ALL USING (auth.uid() = user_id);

-- ── 8. Learning ──
CREATE TABLE IF NOT EXISTS public.learning_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'reading', -- reading | course | podcast | video | practice
  duration_min INT,
  source       TEXT,                            -- book / channel / instructor name
  notes        TEXT,
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learning_logs_own" ON public.learning_logs;
CREATE POLICY "learning_logs_own" ON public.learning_logs FOR ALL USING (auth.uid() = user_id);

-- ── 9. Money (lightweight — daily aggregate, not full ledger) ──
CREATE TABLE IF NOT EXISTS public.money_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount      NUMERIC NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'expense', -- income | expense | savings | business_revenue
  category    TEXT,                              -- groceries | rent | client X | etc.
  notes       TEXT,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.money_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "money_logs_own" ON public.money_logs;
CREATE POLICY "money_logs_own" ON public.money_logs FOR ALL USING (auth.uid() = user_id);

-- ── Realtime publication for all 9 ──
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['focus_sessions','social_logs','cardio_logs','libido_logs','aesthetic_logs','caffeine_logs','sun_logs','learning_logs','money_logs']) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Indexes for the most common queries (user + date range)
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON public.focus_sessions(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_social_logs_user_date    ON public.social_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_cardio_logs_user_date    ON public.cardio_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_libido_logs_user_date    ON public.libido_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_aesthetic_logs_user_date ON public.aesthetic_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_caffeine_logs_user_date  ON public.caffeine_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_sun_logs_user_date       ON public.sun_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_learning_logs_user_date  ON public.learning_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_money_logs_user_date     ON public.money_logs(user_id, log_date DESC);
