-- Schedule recurrence support. NULL or all-seven-days = daily.
-- Otherwise the array lists which weekdays the item should appear on,
-- using JS / Postgres DOW conventions: 0 = Sunday … 6 = Saturday.

ALTER TABLE supplement_stack
  ADD COLUMN IF NOT EXISTS days_of_week INTEGER[] DEFAULT NULL;
