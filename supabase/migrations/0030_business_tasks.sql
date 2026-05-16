-- 0030_business_tasks.sql
-- Business tasks. The control-panel surface for "what am I doing on this
-- business" — replaces the single-field `next_action` text on businesses
-- with a real checklist. Each business can have many tasks; UI shows
-- incomplete first, sorted by priority then created_at.
--
-- Migration auto-imports existing `businesses.next_action` values as the
-- first task on businesses that don't have tasks yet, so no historical
-- "next thing" gets stranded. The next_action column stays in the schema
-- (no DROP) for safety + so the AI context layer can fall back if needed.

create table if not exists public.business_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  uuid not null references public.businesses(id) on delete cascade,
  title        text not null,
  is_complete  boolean not null default false,
  completed_at timestamptz,
  due_date     date,
  priority     int  not null default 0  check (priority in (-1, 0, 1)),  -- -1=low, 0=normal, 1=high
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists business_tasks_user_biz_open_idx
  on public.business_tasks(user_id, business_id, is_complete, priority desc, created_at);

alter table public.business_tasks enable row level security;

drop policy if exists "own business tasks" on public.business_tasks;
create policy "own business tasks" on public.business_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.business_tasks;

-- Auto-import existing next_action text into a first task per business.
-- Idempotent: skips businesses that already have any task rows.
insert into public.business_tasks (user_id, business_id, title)
select b.user_id, b.id, b.next_action
from   public.businesses b
where  b.next_action is not null
  and  trim(b.next_action) <> ''
  and  not exists (select 1 from public.business_tasks t where t.business_id = b.id);
