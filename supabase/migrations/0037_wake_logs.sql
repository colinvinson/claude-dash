-- 0037_wake_logs.sql
-- Wake-confirm signal: a tamper-resistant "I actually got out of bed by X"
-- log, posted by an iOS Shortcut on an NFC-tag tap away from the bed.
--
-- Sleep duration / quality is already covered by Oura → health_logs (no
-- duplicate pipe needed here). What was missing was the *behavioral*
-- signal: "did Sir actually get up on time?" That's volitional (unlike
-- sleep duration, which is biometric) — so it goes into scoring.
--
-- One wake per date. Source defaults to 'nfc' (the NFC-tap path), but
-- 'manual' is allowed for the rare days he confirms via Rowan UI directly.

create table if not exists public.wake_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  wake_at     timestamptz not null,
  target_at   timestamptz,           -- snapshot of profile.wake_target_time at write time
  on_time     boolean,               -- wake_at <= target_at (computed at write)
  source      text not null default 'nfc',
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
