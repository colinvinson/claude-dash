-- Rename the legacy Overseer tables to Jarvis. Internal-only — every user-facing
-- surface already says "Jarvis"; this brings the schema in line.
--
-- RLS policies stay attached automatically on rename, but their NAMES still
-- contain the old identifiers, so we rename them for consistency too.
-- Indexes follow their table automatically. Realtime publication membership
-- also follows the table — no need to drop / re-add.

ALTER TABLE IF EXISTS public.overseer_messages RENAME TO jarvis_messages;
ALTER TABLE IF EXISTS public.overseer_insights RENAME TO jarvis_insights;

-- Rename policies (names are free-form labels — no behavioural effect).
ALTER POLICY "msgs_own"     ON public.jarvis_messages RENAME TO jarvis_messages_own;
ALTER POLICY "insights_own" ON public.jarvis_insights RENAME TO jarvis_insights_own;
