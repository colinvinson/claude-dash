-- 0028_business_agents.sql
-- Per-business agent workforce. Each business can have one or more agent
-- roles assigned to it. The actual agent definitions live on Sir's
-- machine at .claude/agents/<name>.md (managed via Jarvis's
-- cc_define_agent tool). This table is the dashboard's link layer —
-- "what's assigned to which business, and when did it last run."
--
-- When Sir taps Run on an assigned agent, the dashboard opens Jarvis HUD
-- with a pre-formed deploy prompt that includes the business's current
-- context (name, status, MRR, next_action) so the agent runs grounded
-- in real state, not generic instructions.

create table if not exists public.business_agents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  agent_name      text,                  -- matches .claude/agents/<name>.md; null = generic / pending define
  role_label      text not null,         -- display ("Competitor watcher")
  purpose         text,                  -- one-line description of what the agent does
  last_run_at     timestamptz,
  last_session_id text,                  -- session id returned by cc_run_agent
  created_at      timestamptz not null default now()
);

create index if not exists business_agents_user_biz_idx
  on public.business_agents(user_id, business_id);

alter table public.business_agents enable row level security;

drop policy if exists "own business agents" on public.business_agents;
create policy "own business agents" on public.business_agents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ begin alter publication supabase_realtime add table public.business_agents; exception when duplicate_object then null; end $$;
