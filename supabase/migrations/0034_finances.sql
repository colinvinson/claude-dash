-- 0034_finances.sql
-- Finances tab foundation. Two tables:
--
--   wishlist_items       — "products to buy" list. Each item can
--                          optionally link back to a goal_id and/or
--                          business_id (the source that "assigned"
--                          the want). kind distinguishes leverage
--                          (tools that compound — laptop, software,
--                          equipment that produces income) from
--                          consumption (lifestyle / wants). The
--                          asymmetry is load-bearing: Sir's directive
--                          is "rich, not wannabe entrepreneur," so
--                          the system should call out when
--                          consumption outpaces leverage.
--
--   net_worth_snapshots  — monthly point-in-time entry of cash,
--                          investments, business_equity, debts. ONE
--                          row per month (unique constraint). Manual
--                          entry — Sir reads the cash number off
--                          ChatGPT/his bank and types it here.
--                          Rowan's job is the trajectory + the
--                          strategic context, not the aggregation.
--
-- Both are deliberately strategy-layer surfaces. Per Sir's
-- direction: don't compete with ChatGPT on bank linking; own the
-- decisions ChatGPT can't make because it doesn't see his
-- businesses + goals + life data.

create table if not exists public.wishlist_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  goal_id      uuid references public.long_term_goals(id) on delete set null,
  business_id  uuid references public.businesses(id)      on delete set null,
  title        text not null,
  url          text,
  price        numeric check (price is null or price >= 0),
  kind         text not null default 'consumption'
                check (kind in ('leverage','consumption')),
  priority     int  not null default 0 check (priority in (-1, 0, 1)),
  status       text not null default 'wanted'
                check (status in ('wanted','bought','dismissed')),
  notes        text,
  category     text,
  bought_at    timestamptz,
  cost_actual  numeric check (cost_actual is null or cost_actual >= 0),
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists wishlist_items_user_status_idx
  on public.wishlist_items(user_id, status, priority desc, created_at)
  where archived_at is null;
create index if not exists wishlist_items_user_goal_idx
  on public.wishlist_items(user_id, goal_id)
  where archived_at is null and goal_id is not null;
create index if not exists wishlist_items_user_business_idx
  on public.wishlist_items(user_id, business_id)
  where archived_at is null and business_id is not null;

alter table public.wishlist_items enable row level security;
drop policy if exists "own wishlist items" on public.wishlist_items;
create policy "own wishlist items" on public.wishlist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table public.wishlist_items;

create table if not exists public.net_worth_snapshots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  snapshot_date   date not null,                          -- typically 1st of month
  cash            numeric default 0 check (cash             >= 0),
  investments     numeric default 0 check (investments      >= 0),
  business_equity numeric default 0 check (business_equity  >= 0),
  debts           numeric default 0 check (debts            >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists net_worth_snapshots_user_date_idx
  on public.net_worth_snapshots(user_id, snapshot_date desc);

alter table public.net_worth_snapshots enable row level security;
drop policy if exists "own net worth" on public.net_worth_snapshots;
create policy "own net worth" on public.net_worth_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table public.net_worth_snapshots;
