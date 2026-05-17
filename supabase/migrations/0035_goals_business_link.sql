-- 0035_goals_business_link.sql
-- Goals should live UNDER a specific business, not float in a generic
-- "business bucket" pool. Adds an optional business_id link on
-- long_term_goals. Existing business-bucket goals get left with
-- business_id = NULL (no automatic backfill — Sir picks which business
-- each one belongs to via the goal widget). On business deletion the
-- goal stays but unlinks (SET NULL) so Sir can re-home it.
--
-- bucket column stays as-is — it's still the personal/business divide.
-- business_id is the FINER scoping inside the business bucket.

alter table public.long_term_goals
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

create index if not exists long_term_goals_business_idx
  on public.long_term_goals(business_id)
  where business_id is not null and is_active = true;
