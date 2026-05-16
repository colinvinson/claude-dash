-- 0027_businesses.sql
-- Businesses portfolio. Each business is an entity (not just a goal), with
-- status / stage / MRR / customers tracked over time. Revenue log keeps a
-- daily history so we can compute MoM growth and surface trend in the
-- snapshot.
--
-- Statuses follow startup-stage convention: idea → building → live →
-- growing → paused. archived_at handles wound-down without polluting the
-- status enum.

create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  status          text not null default 'idea'
                  check (status in ('idea','building','live','growing','paused')),
  category        text,
  monthly_revenue numeric default 0 check (monthly_revenue >= 0),
  customer_count  integer default 0 check (customer_count >= 0),
  next_action     text,
  notes           text,
  started_at      date,
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists businesses_user_archived_idx
  on public.businesses(user_id, archived_at);

create table if not exists public.business_revenue_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount      numeric not null,
  log_date    date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists business_revenue_log_user_biz_date_idx
  on public.business_revenue_log(user_id, business_id, log_date desc);

alter table public.businesses              enable row level security;
alter table public.business_revenue_log    enable row level security;

drop policy if exists "own businesses"        on public.businesses;
drop policy if exists "own business revenue"  on public.business_revenue_log;

create policy "own businesses" on public.businesses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own business revenue" on public.business_revenue_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime so UI tiles update across tabs / devices live.
alter publication supabase_realtime add table public.businesses;
alter publication supabase_realtime add table public.business_revenue_log;
