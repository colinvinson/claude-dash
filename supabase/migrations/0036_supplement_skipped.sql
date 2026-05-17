-- 0036_supplement_skipped.sql
-- Adds an explicit "skipped" state to supplement_logs so a routine item
-- can be acknowledged as NOT-going-to-happen-today without being marked
-- taken. Distinct from done (taken=true) and undone (no row): skipped
-- inserts a row with skipped=true, taken_at stays null.
--
-- The adherence + streak math should treat a skipped day as
-- "acknowledged miss" (still breaks unbroken-streak by default but
-- shouldn't pile into "you forgot" insights). Behavior tuning can come
-- later — schema first.

alter table public.supplement_logs
  add column if not exists skipped boolean not null default false;

create index if not exists supplement_logs_user_date_skipped_idx
  on public.supplement_logs(user_id, log_date, skipped);
