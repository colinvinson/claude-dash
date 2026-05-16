-- 0029_artifacts_to_businesses.sql
-- Wire jarvis_artifacts back to the business that produced them. Each
-- artifact can be optionally tagged with the business it belongs to and
-- the specific agent role that authored it. With this in place,
-- BusinessDetail can surface "Competitor watcher · 2h ago — <artifact>"
-- inline so the agents stop feeling like fire-and-forget.
--
-- Both columns are nullable — legacy artifacts and one-off Jarvis writes
-- that aren't business-scoped continue to work unchanged.

alter table public.jarvis_artifacts
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

alter table public.jarvis_artifacts
  add column if not exists business_agent_id uuid references public.business_agents(id) on delete set null;

create index if not exists jarvis_artifacts_business_idx
  on public.jarvis_artifacts(business_id, created_at desc)
  where business_id is not null;

create index if not exists jarvis_artifacts_business_agent_idx
  on public.jarvis_artifacts(business_agent_id, created_at desc)
  where business_agent_id is not null;
