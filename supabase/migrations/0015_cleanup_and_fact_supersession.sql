-- Two things in this migration:
--   1. Drop the obsolete worker tables (replaced by Claude Code agent runtime
--      which is the source of truth — nothing reads or writes these anymore).
--   2. Add supersession fields to jarvis_facts so the algorithm can mark old
--      facts as superseded when a contradicting one arrives, preventing
--      slow memory rot.

-- ── 1. Drop obsolete tables ──────────────────────────────────────────────
-- jarvis_workers + jarvis_worker_runs: replaced by `claude agents` runtime + CC dispatch tools.
-- jarvis_universal_lessons: was the cross-worker learning store; CC agents handle their own skills now.
-- jarvis_conversations: superseded by jarvis_messages (which IS being written / read now).
DROP TABLE IF EXISTS public.jarvis_worker_runs CASCADE;
DROP TABLE IF EXISTS public.jarvis_universal_lessons CASCADE;
DROP TABLE IF EXISTS public.jarvis_workers CASCADE;
DROP TABLE IF EXISTS public.jarvis_conversations CASCADE;

-- ── 2. Fact supersession ─────────────────────────────────────────────────
-- When Sir tells Jarvis "I switched gyms" after a fact about Les Roches existed,
-- the old fact gets marked superseded and the new fact takes its place. Stale
-- facts stop polluting context but remain queryable for history.
ALTER TABLE public.jarvis_facts
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.jarvis_facts(id) ON DELETE SET NULL;

-- Active facts only: an index that excludes superseded rows, so the hot path
-- (Jarvis chat context) is fast even with years of fact history.
CREATE INDEX IF NOT EXISTS idx_jarvis_facts_active
  ON public.jarvis_facts (user_id, last_referenced_at DESC NULLS LAST, created_at DESC)
  WHERE superseded_at IS NULL;
