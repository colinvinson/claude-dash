-- Schedule timeline: per-item start time + duration so the Schedule tab can
-- render items at real clock times (8:15 AM, 9:00 AM, etc.) rather than just
-- coarse buckets (Morning / Evening). All fields are nullable — items without
-- a scheduled_at fall back to inferred times from their `timing` string.
--
-- Also adds optional `icon` (lucide-react name) and `color` (hex) overrides
-- so a Schedule item can render with a custom icon + circle color independent
-- of its category. Without overrides, the category's defaults apply.

ALTER TABLE supplement_stack
  ADD COLUMN IF NOT EXISTS scheduled_at TIME,
  ADD COLUMN IF NOT EXISTS duration_min INTEGER,
  ADD COLUMN IF NOT EXISTS icon         TEXT,
  ADD COLUMN IF NOT EXISTS color        TEXT;

-- Soft sort index so the schedule renders quickly even with hundreds of items.
CREATE INDEX IF NOT EXISTS idx_supplement_stack_scheduled
  ON supplement_stack (user_id, scheduled_at);
