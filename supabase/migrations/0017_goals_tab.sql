-- Goals tab — Life + Businesses sub-tab structure.
-- Replaces the half-finished Business tab with a unified bucketed goals surface.
--
-- Decision: wipe + restart. Per-user-direction. All existing long_term_goals
-- get archived (is_active=false) so they stay in history but don't clutter the
-- new tab. User re-adds what's still relevant into the bucketed structure.

-- 1. Archive all existing long-term goals.
UPDATE long_term_goals SET is_active = false;

-- 2. Add bucket (drives Life vs Businesses tab) + the per-goal fields the
--    widgets need: free-form current_state + next_steps notes, schemaless
--    metrics for business KPIs, sort_order for manual ordering, and an
--    AI-summary surface (lazy-refreshed weekly, never auto on render).
ALTER TABLE long_term_goals
  ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS current_state         TEXT,
  ADD COLUMN IF NOT EXISTS next_steps            TEXT,
  ADD COLUMN IF NOT EXISTS metrics               JSONB,
  ADD COLUMN IF NOT EXISTS sort_order            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_summary            TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ;

-- Constrain bucket to the two values the UI actually uses. CHECK on its own
-- ALTER is the safest path: doesn't conflict with the IF NOT EXISTS ADD above.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'long_term_goals_bucket_check'
  ) THEN
    ALTER TABLE long_term_goals
      ADD CONSTRAINT long_term_goals_bucket_check CHECK (bucket IN ('personal', 'business'));
  END IF;
END $$;

-- 3. Routine → goal linkage. Lets the widget compute progress from adherence.
ALTER TABLE supplement_stack
  ADD COLUMN IF NOT EXISTS linked_goal_id UUID REFERENCES long_term_goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplement_stack_linked_goal
  ON supplement_stack(linked_goal_id)
  WHERE linked_goal_id IS NOT NULL;

-- 4. Active-goal lookups should be fast even with years of archived rows.
CREATE INDEX IF NOT EXISTS idx_long_term_goals_active_bucket
  ON long_term_goals(user_id, bucket, sort_order)
  WHERE is_active = true;
