-- 0031_business_agents_schedule.sql
-- Per-agent scheduling. Each business_agent can optionally run on a
-- cadence — daily / weekly / monthly at a fixed hour (and weekday or
-- day-of-month). A Vercel Cron endpoint hits the dispatch API every
-- ~5 min, finds agents whose next_run_at has passed, and inserts a
-- jarvis_cc_dispatches row. The bridge daemon on Sir's Mac picks it up
-- the next time it's online and runs `claude --bg --agent <name>` with
-- the business context, exactly the same path as a manual Run tap.
--
-- next_run_at is the canonical "when is this due" timestamp. The cron
-- endpoint queries by `next_run_at <= now() AND schedule_kind != 'none'`
-- and bumps next_run_at after dispatching. Recomputation logic lives
-- server-side so the schema stays simple (no Postgres-side cron math).

alter table public.business_agents
  add column if not exists schedule_kind text not null default 'none'
    check (schedule_kind in ('none', 'daily', 'weekly', 'monthly'));

alter table public.business_agents
  add column if not exists schedule_hour int default 9
    check (schedule_hour is null or (schedule_hour >= 0 and schedule_hour <= 23));

alter table public.business_agents
  add column if not exists schedule_dow int default 1
    check (schedule_dow is null or (schedule_dow >= 0 and schedule_dow <= 6));   -- 0=Sun, 6=Sat

alter table public.business_agents
  add column if not exists schedule_dom int default 1
    check (schedule_dom is null or (schedule_dom >= 1 and schedule_dom <= 28));  -- cap at 28 to avoid Feb edge cases

alter table public.business_agents
  add column if not exists next_run_at timestamptz;

-- Cron queries by (schedule_kind, next_run_at). Index keeps the lookup
-- O(log N) instead of O(N) once Sir has a handful of scheduled agents
-- across many businesses.
create index if not exists business_agents_schedule_due_idx
  on public.business_agents(schedule_kind, next_run_at)
  where schedule_kind <> 'none';
