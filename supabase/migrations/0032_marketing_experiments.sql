-- 0032_marketing_experiments.sql
-- Marketing experiments. The closed-loop layer that makes content/agents
-- "get smarter over time" — every variant gets logged with its outcome
-- (impressions, clicks, conversions, attributed revenue). When agents
-- dispatch on a business, the deploy prompt now includes the recent
-- experiment history + outcomes, so the next round of drafts is grounded
-- in what's actually converting for Sir's audience instead of generic
-- best practices.
--
-- business_id is nullable — supports pre-business experiments + cross-
-- business / personal-brand campaigns. channel is free-text so it works
-- for any platform without a hard-coded enum drifting out of date.
-- All metrics are nullable so logging a draft variant before posting
-- (or before metrics come in) is the natural flow.

create table if not exists public.marketing_experiments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  business_id         uuid references public.businesses(id) on delete set null,
  variant_label       text not null,                     -- "Hook A", "Subject line v2"
  variant_text        text not null,                     -- the actual content
  channel             text not null,                     -- twitter / linkedin / newsletter / cold_email / landing / etc
  posted_at           timestamptz,                       -- nullable: drafts haven't shipped yet
  link                text,                              -- URL to the live post if applicable
  notes               text,                              -- post-mortem notes
  -- Outcomes — nullable, fill in as data comes in
  impressions         integer check (impressions is null or impressions >= 0),
  clicks              integer check (clicks      is null or clicks      >= 0),
  conversions         integer check (conversions is null or conversions >= 0),
  revenue_attributed  numeric check (revenue_attributed is null or revenue_attributed >= 0),
  archived_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists marketing_experiments_user_biz_posted_idx
  on public.marketing_experiments(user_id, business_id, posted_at desc)
  where archived_at is null;

alter table public.marketing_experiments enable row level security;

drop policy if exists "own marketing experiments" on public.marketing_experiments;
create policy "own marketing experiments" on public.marketing_experiments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ begin alter publication supabase_realtime add table public.marketing_experiments; exception when duplicate_object then null; end $$;
