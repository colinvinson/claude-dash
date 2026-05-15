-- Mark stack items as "running low" — drives the supply reminder badge on the
-- Schedule timeline. Toggled directly from each row; user clears it after
-- reordering.

ALTER TABLE public.supplement_stack
  ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN NOT NULL DEFAULT false;
