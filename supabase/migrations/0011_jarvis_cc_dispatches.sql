-- Queue table the web app writes to when it wants to dispatch / inspect / control
-- a Claude Code agent. The local bridge daemon (scripts/jarvis-bridge.ts) subscribes
-- via Realtime, shells out to `claude`, and writes the result back into the row.
-- Web clients await the UPDATE via Realtime filter on their own row id.

CREATE TABLE jarvis_cc_dispatches (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  kind         TEXT NOT NULL,                                -- 'run' | 'list' | 'logs' | 'stop' | 'define' | 'list_defined' | 'read'
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending',              -- 'pending' | 'running' | 'done' | 'error'
  result       JSONB,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE jarvis_cc_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispatches_own" ON jarvis_cc_dispatches FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_cc_dispatches_pending ON jarvis_cc_dispatches (status, created_at)
  WHERE status = 'pending';

ALTER PUBLICATION supabase_realtime ADD TABLE jarvis_cc_dispatches;
