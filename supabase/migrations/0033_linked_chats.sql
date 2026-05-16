-- 0033_linked_chats.sql
-- Linked chats — external AI conversation references attached to a
-- business or a long-term goal. Sir often has Claude.ai (or ChatGPT)
-- conversations doing the heavy lifting on a specific business or
-- goal (pricing research, protocol design, deep brainstorms). Without
-- this layer those conversations live in a different app and get lost
-- from the dashboard's view. With it, the conversation is one tap
-- away from the surface it's actually about.
--
-- business_id and goal_id are both nullable + independent — most rows
-- will reference exactly one, but allowing both means a chat that
-- spans a business AND a personal goal can link to both. source is
-- free-text-ish but constrained to the common cases so the UI can
-- show appropriate icons.

create table if not exists public.linked_chats (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  url          text,
  source       text not null default 'claude'
                check (source in ('claude','chatgpt','jarvis','other')),
  summary      text,
  business_id  uuid references public.businesses(id)        on delete set null,
  goal_id      uuid references public.long_term_goals(id)   on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists linked_chats_user_business_idx
  on public.linked_chats(user_id, business_id, created_at desc)
  where archived_at is null and business_id is not null;

create index if not exists linked_chats_user_goal_idx
  on public.linked_chats(user_id, goal_id, created_at desc)
  where archived_at is null and goal_id is not null;

alter table public.linked_chats enable row level security;

drop policy if exists "own linked chats" on public.linked_chats;
create policy "own linked chats" on public.linked_chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.linked_chats;
