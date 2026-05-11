-- ============================================================
-- Rowan Dashboard — LifeMax + Business restructure
-- Adds category columns so existing tables can serve multiple
-- routine types (supplements / medications / injections / skincare)
-- and journal entries can be split (personal / business).
-- Run in Supabase SQL Editor after 0006.
-- ============================================================

-- Routine items: supplement_stack now hosts all daily-routine items
ALTER TABLE public.supplement_stack
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'supplement';
-- Valid values: 'supplement' | 'medication' | 'injection' | 'skincare'

-- Journal entries: separate personal vs business brain dumps
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'personal';
-- Valid values: 'personal' | 'business'

-- Backfill: existing rows already get the defaults above. No data migration needed.
