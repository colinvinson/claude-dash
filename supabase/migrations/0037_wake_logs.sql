-- 0037_wake_logs.sql
-- Wake-on-time signal: extracted from Oura's `/sleep` session endpoint
-- (bedtime_end of the canonical long_sleep session per day). Written by
-- /api/oura/poll. One row per date, on_time = wake_at <= target_at.
--
-- Why a separate table from health_logs (which already carries the rest
-- of Oura's data): wake_at is a *scoring-eligible* derived field —
-- on_time gets weight in lib/scoring.ts, and `wake_on_time` feeds the
-- 21-day snapshot CSV column the correlation engine reads. Keeping it
-- in its own narrow table makes the realtime subscription cheap and the
-- scoring read trivial.
--
-- source: 'oura' (default, written by poll) or 'manual' (useWakeConfirm.confirmNow,
-- a fallback for days when Oura didn't sync).

create table if not exists public.wake_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  wake_at     timestamptz not null,
  target_at   timestamptz,           -- snapshot of profile.wake_target_time at write time
  on_time     boolean,               -- wake_at <= target_at (computed at write)
  source      text not null default 'oura',
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists wake_logs_user_date_idx
  on public.wake_logs(user_id, date desc);

alter table public.wake_logs enable row level security;

drop policy if exists "wake_logs_own" on public.wake_logs;
create policy "wake_logs_own" on public.wake_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Wake target lives on profiles so it's already covered by profiles_own RLS.
-- Default 07:30 — Sir can change it via Settings.
alter table public.profiles
  add column if not exists wake_target_time time not null default '07:30:00';

-- Realtime: enable so useWakeConfirm picks up NFC-tap inserts live.
do $$ begin
  alter publication supabase_realtime add table public.wake_logs;
exception when duplicate_object then null;
end $$;
