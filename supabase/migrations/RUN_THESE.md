# Migrations checklist

## Fastest path (recommended)

Open Supabase SQL Editor → paste the entire contents of **`APPLY_ALL.sql`** → Run. Done.

It concatenates every migration after `0018_catch_up.sql` in order. Every statement inside is idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, etc.), so running it again later — or partway through — is always safe; already-applied changes no-op.

If you've never run any migrations at all, run `0018_catch_up.sql` first (it covers `0001`-`0017`), then `APPLY_ALL.sql` for everything since.

## Migrations after the 0018 catch-up

These are the individual files that `APPLY_ALL.sql` bundles. Listed for reference + so the changelog has a single source of truth.

| # | File | What it adds | Required by |
|---|------|--------------|-------------|
| 0019 | `0019_mesocycles.sql` | `mesocycles` table — block-style hypertrophy training | Gym tab MesocycleCard, coach deload logic |
| 0020 | `0020_running_low.sql` | `supplement_stack.is_running_low` boolean | "Running low" pill on schedule rows |
| 0021 | `0021_insight_kind.sql` | `jarvis_insights.kind` column + index | Insight dedup (PB / performance / recovery / goal / correlation) |
| 0022 | `0022_gym_equipment.sql` | `gym_locations.available_equipment` array + `coach_dismissals` table | Optimization engine + equipment selector |
| 0023 | `0023_goals_upgrade.sql` | Goal types, focus flag, `goal_milestones` table, `goal_metrics` table | Goals tab v2, focus stars, metric tracking, Home goals surface |
| 0024 | `0024_dimension_expansion.sql` | **9 new dimension tables** (focus, social, cardio, libido, aesthetic, caffeine, sun, learning, money) | LogSheet new tiles + Home DimensionsCard + Jarvis context.dimensions |
| 0025 | `0025_monthly_retros.sql` | `monthly_retros` table | MonthlyRetroCard on Home |
| 0026 | `0026_aesthetic_photos_bucket.sql` | Private Storage bucket `aesthetic-photos` + RLS | Aesthetic check-in photo upload |
| 0027 | `0027_businesses.sql` | `businesses` + `business_revenue_log` tables | Businesses portfolio hub on /businesses tab |
| 0028 | `0028_business_agents.sql` | `business_agents` table | Per-business agent workforce in BusinessDetail sheet |
| 0029 | `0029_artifacts_to_businesses.sql` | `business_id` + `business_agent_id` on `jarvis_artifacts` | Inline per-agent artifact previews in BusinessAgents |
| 0030 | `0030_business_tasks.sql` | `business_tasks` table + auto-import of legacy `next_action` | Tasks checklist + activity feed on BusinessDetail |
| 0031 | `0031_business_agents_schedule.sql` | `schedule_kind` / `schedule_hour` / `schedule_dow` / `schedule_dom` / `next_run_at` columns on `business_agents` | Vercel Cron scheduling for autonomous agent runs |
| 0032 | `0032_marketing_experiments.sql` | `marketing_experiments` table — variant text + channel + outcome metrics | Closed-loop learning: agents see what's been tried + what converted before drafting new variants |
| 0033 | `0033_linked_chats.sql` | `linked_chats` table — external Claude.ai / ChatGPT conversation references attached to a business or goal | Linked Chats section in BusinessDetail + GoalWidget |
| 0034 | `0034_finances.sql` | `wishlist_items` + `net_worth_snapshots` tables | Finances tab — Wants list + Net worth snapshots + Cash flow aggregate + Strategy Jarvis surface |
| 0035 | `0035_goals_business_link.sql` | `business_id` column on `long_term_goals` | Goals nested under a specific business in BusinessDetail |
| 0036 | `0036_supplement_skipped.sql` | `skipped` boolean on `supplement_logs` | Skip-today affordance on Schedule items (distinct from done/undone) |
| 0037 | `0037_wake_logs.sql` | `wake_logs` table + `wake_target_time` column on `profiles` | Wake-on-time scoring — Oura `bedtime_end` extracted nightly, scored vs profile.wake_target_time |

## After running, verify

A quick way to check everything's applied:

```sql
-- 1. Dimension tables exist
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('focus_sessions','social_logs','cardio_logs','libido_logs','aesthetic_logs','caffeine_logs','sun_logs','learning_logs','money_logs');
-- Expect: 9

-- 2. Goals upgraded
SELECT goal_type, target_value, is_focus FROM long_term_goals LIMIT 1;
-- Expect: no errors

-- 3. Insight kinds work
SELECT kind FROM jarvis_insights GROUP BY kind;
-- Should include "general" at minimum after 0021

-- 4. Storage bucket exists
SELECT id, public FROM storage.buckets WHERE id = 'aesthetic-photos';
-- Expect: ('aesthetic-photos', false)

-- 5. Finances tables exist (0034)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('wishlist_items', 'net_worth_snapshots');
-- Expect: 2
```

## Push notifications (separate from SQL migrations)

For #4 (push notifications) to actually fire, the following env vars must be set in your Vercel project (or `.env.local` for local dev):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-vapid-public>
VAPID_PRIVATE_KEY=<your-vapid-private>
VAPID_SUBJECT=mailto:colinvinson@icloud.com
```

Generate a keypair with `npx web-push generate-vapid-keys`. Until these are set, the push calls silently no-op (insights still surface in-app via the strip — no errors).
