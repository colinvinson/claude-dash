-- ============================================================
-- Rowan Dashboard — Jarvis (system operator)
-- Persistent memory, worker definitions, worker runs, conversations.
-- Run in Supabase SQL Editor after 0007.
-- ============================================================

-- Persistent facts Jarvis has learned about the user
CREATE TABLE IF NOT EXISTS public.jarvis_facts (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fact               TEXT NOT NULL,
  source             TEXT NOT NULL,        -- 'chat' | 'worker' | 'manual'
  confidence         NUMERIC DEFAULT 0.8,
  last_referenced_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.jarvis_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facts_own" ON public.jarvis_facts FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_facts_user ON public.jarvis_facts (user_id, created_at DESC);

-- Worker definitions
CREATE TABLE IF NOT EXISTS public.jarvis_workers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  system_prompt TEXT NOT NULL,
  schedule      TEXT,                       -- cron string OR null for on-demand
  allowed_tools TEXT[] DEFAULT '{}',
  learned_facts JSONB DEFAULT '{}',         -- worker self-knowledge (grows over time)
  is_active     BOOLEAN DEFAULT true,
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.jarvis_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workers_own" ON public.jarvis_workers FOR ALL USING (auth.uid() = user_id);

-- Per-run history for monitoring + learning
CREATE TABLE IF NOT EXISTS public.jarvis_worker_runs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id    UUID REFERENCES public.jarvis_workers(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'error'
  output       TEXT,
  ai_summary   TEXT,
  error        TEXT,
  tool_calls   JSONB DEFAULT '[]'
);
ALTER TABLE public.jarvis_worker_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs_own" ON public.jarvis_worker_runs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_runs_worker ON public.jarvis_worker_runs (worker_id, started_at DESC);

-- Conversation transcripts
CREATE TABLE IF NOT EXISTS public.jarvis_conversations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transcript  JSONB NOT NULL,
  summary     TEXT,
  started_at  TIMESTAMPTZ DEFAULT now(),
  ended_at    TIMESTAMPTZ
);
ALTER TABLE public.jarvis_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "convo_own" ON public.jarvis_conversations FOR ALL USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.jarvis_facts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jarvis_workers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jarvis_worker_runs;
