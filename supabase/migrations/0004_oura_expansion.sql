-- ============================================================
-- Rowan Dashboard — Oura Data Expansion
-- Adds columns for stress, resilience, VO2 max, and detected workouts.
-- Run in Supabase SQL Editor after 0003.
-- ============================================================

ALTER TABLE public.health_logs ADD COLUMN IF NOT EXISTS stress_high_sec    INT;
ALTER TABLE public.health_logs ADD COLUMN IF NOT EXISTS recovery_high_sec  INT;
ALTER TABLE public.health_logs ADD COLUMN IF NOT EXISTS stress_day_summary TEXT;
ALTER TABLE public.health_logs ADD COLUMN IF NOT EXISTS resilience_level   TEXT;
ALTER TABLE public.health_logs ADD COLUMN IF NOT EXISTS vo2_max            NUMERIC;
ALTER TABLE public.health_logs ADD COLUMN IF NOT EXISTS oura_workouts      JSONB;
