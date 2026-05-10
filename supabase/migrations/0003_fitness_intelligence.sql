-- ============================================================
-- Rowan Dashboard — Fitness Intelligence
-- Run in Supabase SQL Editor after 0002.
-- ============================================================

-- Add exercise classification columns
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS exercise_type TEXT DEFAULT 'Secondary';
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS muscle_targets TEXT[] DEFAULT '{}';

-- Add RPE to workout sets (6=Easy → 10=Max effort)
ALTER TABLE public.workout_sets ADD COLUMN IF NOT EXISTS rpe INT CHECK (rpe BETWEEN 6 AND 10);

-- Add body_weight to profiles for future body composition tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_weight_kg NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_goal TEXT DEFAULT 'hypertrophy';
