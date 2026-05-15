"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  computeRecoveryScore,
  computeSessionStrain,
  muscleFatigue,
  adjustForRecovery,
  type RecoveryResult,
  type MuscleFatigueResult,
  type Adjustment,
  type Prescription,
  type MuscleSetRow,
} from "@/lib/fitness/recovery";

export type WorkoutSet = {
  id: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  est_1rm: number;
  logged_at: string;
  log_date: string;
};

export type Session = {
  date: string;
  sets: WorkoutSet[];
  bestSet: WorkoutSet;
  volume: number;
  topEst1rm: number;
};

export type CoachStatus = "NEW" | "PROGRESS" | "GRIND" | "STALLING" | "REGRESSION";

export type CoachVerdict = {
  status: CoachStatus;
  targetWeight: number;
  targetReps: number;
  targetSets: number;
  rpeCap: number | null;
  repRange: { min: number; max: number };
  headline: string;
  tip: string;
  rpeContext: string | null;
  recoveryAdjustment: Adjustment | null;
};

export type Exercise = {
  id: string;
  name: string;
  split_day: string;
  gym_id: string | null;
  exercise_type: string;
  muscle_group: string;
  muscle_targets: string[];
};

export type Gym = { id: string; name: string };

export type MuscleVolume = {
  muscle: string;
  sets: number;
  frequency: number;
  target: { min: number; max: number };
  status: "under" | "optimal" | "over";
};

// Rep ranges by exercise type — hypertrophy science
const REP_TARGETS: Record<string, { min: number; max: number }> = {
  Compound:  { min: 5,  max: 10 },
  Secondary: { min: 8,  max: 12 },
  Isolation: { min: 12, max: 20 },
};

// Weekly volume targets (sets) per muscle group — MEV to MRV
const VOLUME_TARGETS: Record<string, { min: number; max: number }> = {
  Chest:      { min: 10, max: 20 },
  Back:       { min: 10, max: 20 },
  Shoulders:  { min: 10, max: 20 },
  "Rear Delt":{ min: 6,  max: 12 },
  Triceps:    { min: 8,  max: 15 },
  Biceps:     { min: 8,  max: 15 },
  Quads:      { min: 10, max: 20 },
  Hamstrings: { min: 8,  max: 15 },
  Glutes:     { min: 8,  max: 15 },
  Calves:     { min: 8,  max: 15 },
};

export { VOLUME_TARGETS };

function groupIntoSessions(sets: WorkoutSet[]): Session[] {
  const byDate = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const arr = byDate.get(s.log_date) ?? [];
    arr.push(s);
    byDate.set(s.log_date, arr);
  }
  return [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const daySets = byDate.get(date)!;
      const bestSet = daySets.reduce((best, s) => (s.est_1rm > best.est_1rm ? s : best), daySets[0]);
      const volume  = daySets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
      return { date, sets: daySets, bestSet, volume, topEst1rm: bestSet.est_1rm };
    });
}

function analyze(
  pastSessions: Session[],
  exerciseType: string,
  exerciseName: string,
): CoachVerdict {
  const repRange = REP_TARGETS[exerciseType] ?? REP_TARGETS.Secondary;
  const isCompound  = exerciseType === "Compound";
  const isIsolation = exerciseType === "Isolation";

  if (pastSessions.length === 0) {
    const startWeight = isCompound ? 40 : isIsolation ? 10 : 20;
    return {
      status: "NEW", targetWeight: startWeight, targetReps: repRange.min, targetSets: 3, rpeCap: null, repRange,
      headline: `First session — start at ${startWeight}kg`,
      tip: `${isCompound ? "Compounds build the foundation. " : isIsolation ? "Focus on the squeeze, not the weight. " : ""}Nail form before adding load. Hit ${repRange.min}–${repRange.max} reps clean.`,
      rpeContext: null,
      recoveryAdjustment: null,
    };
  }

  const last = pastSessions[0].bestSet;
  const prev = pastSessions[1]?.bestSet ?? null;
  const lastRPE = last.rpe;

  // Build RPE context string
  let rpeContext: string | null = null;
  if (lastRPE) {
    if (lastRPE >= 9)    rpeContext = `Last session RPE ${lastRPE}/10 — working at max, make sure recovery matches`;
    else if (lastRPE === 8) rpeContext = `Last session RPE 8/10 — perfect hypertrophy intensity`;
    else if (lastRPE <= 7) rpeContext = `Last session RPE ${lastRPE}/10 — too easy. Hypertrophy requires RPE 8–10 (0–2 reps left in the tank)`;
  }

  // Regression: est_1RM down >5% vs previous session
  if (prev && last.est_1rm < prev.est_1rm * 0.95) {
    return {
      status: "REGRESSION", targetWeight: prev.weight_kg, targetReps: repRange.min, targetSets: 3, rpeCap: 8, repRange,
      headline: `Step back to ${prev.weight_kg}kg — strength dropped`,
      tip: "Est. 1RM fell >5%. Return to last good weight and rebuild. Check sleep quality, caloric intake, and weekly volume — you may be overreaching.",
      rpeContext,
      recoveryAdjustment: null,
    };
  }

  // Progress: hit top of rep range → add weight
  if (last.reps >= repRange.max) {
    const increment = isCompound ? 2.5 : 1.25;
    const next = Math.round((last.weight_kg + increment) * 100) / 100;
    const rpeNote = lastRPE && lastRPE >= 9
      ? " — even though it felt maximal, the reps prove you're ready."
      : ".";
    return {
      status: "PROGRESS", targetWeight: next, targetReps: repRange.min, targetSets: 3, rpeCap: null, repRange,
      headline: `Load up — ${next}kg, aim for ${repRange.min} reps`,
      tip: `You hit ${last.reps} reps at ${last.weight_kg}kg${rpeNote} Add ${increment}kg and grind back up to ${repRange.max}. ${isIsolation ? "Keep tension on the muscle throughout." : isCompound ? "Same technique, new weight." : ""}`,
      rpeContext,
      recoveryAdjustment: null,
    };
  }

  // Stalling: same weight, no rep gain over 3 sessions
  if (pastSessions.length >= 3) {
    const recent = pastSessions.slice(0, 3).map((s) => s.bestSet);
    const stalled =
      recent.every((s) => s.weight_kg === recent[0].weight_kg) &&
      recent[0].reps <= recent[2].reps;

    if (stalled) {
      const highRPE = recent.some((s) => s.rpe && s.rpe >= 9);
      const lowRPE  = recent.every((s) => s.rpe && s.rpe <= 7);
      const tip = highRPE
        ? `Training near max effort with no progress = recovery/volume issue. Take a deload: drop to ${Math.round(last.weight_kg * 0.8)}kg for one session, then come back fresh. Check sleep and calories.`
        : lowRPE
        ? `You're not pushing hard enough. Same weight 3 sessions but RPE is low. On your last set, leave nothing in the tank — rep it to near-failure.`
        : `3 sessions at ${last.weight_kg}kg. Try drop-sets: after your top set, strip ${Math.round(last.weight_kg * 0.15)}kg and hit a full AMRAP with no rest. Metabolic overload breaks plateaus.`;
      return {
        status: "STALLING", targetWeight: last.weight_kg, targetReps: last.reps, targetSets: 3, rpeCap: null, repRange,
        headline: `Plateau at ${last.weight_kg}kg — ${highRPE ? "deload needed" : "push harder"}`,
        tip,
        rpeContext,
        recoveryAdjustment: null,
      };
    }
  }

  // Grind: in range, push for more reps
  const rpeNote = lastRPE && lastRPE <= 7
    ? ` Your RPE was only ${lastRPE} — you have more capacity. Push harder on working sets.`
    : "";
  return {
    status: "GRIND", targetWeight: last.weight_kg, targetReps: Math.min(last.reps + 1, repRange.max), targetSets: 3, rpeCap: null, repRange,
    headline: `${last.weight_kg}kg — push for ${Math.min(last.reps + 1, repRange.max)}+ reps`,
    tip: `Last best: ${last.reps} reps. You need ${repRange.max} to unlock the next weight.${rpeNote} ${isIsolation ? "Slow 3-second eccentric — time under tension drives growth." : isCompound ? "Control the descent, explode up." : ""}`,
    rpeContext,
    recoveryAdjustment: null,
  };
}

type WeeklySet = {
  muscle_group: string;
  muscle_targets: string[];
  log_date: string;
  logged_at: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
};

type HealthDay = {
  date: string;
  readiness_score: number | null;
  hrv: number | null;
  sleep_score: number | null;
  sleep_hours: number | null;
  resilience_level: string | null;
};

export function useWorkout() {
  const [gyms,       setGyms]       = useState<Gym[]>([]);
  const [exercises,  setExercises]  = useState<Exercise[]>([]);
  const [history,    setHistory]    = useState<WorkoutSet[]>([]);
  const [weeklyRaw,  setWeeklyRaw]  = useState<WeeklySet[]>([]);
  const [health7d,   setHealth7d]   = useState<HealthDay[]>([]);
  const [activeGymId,   setActiveGymId]   = useState<string | null>(null);
  const [activeDay,     setActiveDay]     = useState("Push");
  const [activeExId,    setActiveExId]    = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [userId,     setUserId]     = useState<string | null>(null);
  const supabase   = createClient();
  const channelRef = useRef(`workout-${Math.random().toString(36).slice(2)}`);

  const fetchWeeklyVolume = useCallback(async (uid: string) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const { data } = await supabase
      .from("workout_sets")
      .select("log_date, logged_at, weight_kg, reps, rpe, exercises(muscle_group, muscle_targets)")
      .eq("user_id", uid)
      .gte("log_date", cutoffStr);
    if (data) {
      setWeeklyRaw(
        (data as unknown as Array<{
          log_date: string;
          logged_at: string;
          weight_kg: number;
          reps: number;
          rpe: number | null;
          exercises: { muscle_group: string; muscle_targets: string[] } | { muscle_group: string; muscle_targets: string[] }[] | null;
        }>)
          .map((r) => {
            const ex = r.exercises;
            const exObj = Array.isArray(ex) ? ex[0] : ex;
            return {
              muscle_group:   exObj?.muscle_group   ?? "",
              muscle_targets: exObj?.muscle_targets ?? [],
              log_date:       r.log_date,
              logged_at:      r.logged_at,
              weight_kg:      r.weight_kg,
              reps:           r.reps,
              rpe:            r.rpe,
            };
          })
          .filter((r) => r.muscle_group)
      );
    }
  }, [supabase]);

  const fetchHealth7d = useCallback(async (uid: string) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const { data } = await supabase
      .from("health_logs")
      .select("date, readiness_score, hrv, sleep_score, sleep_hours, resilience_level")
      .eq("user_id", uid)
      .gte("date", cutoffStr)
      .order("date", { ascending: true });
    setHealth7d((data ?? []) as HealthDay[]);
  }, [supabase]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const [gymsRes, exRes] = await Promise.all([
        supabase.from("gym_locations").select("*").eq("user_id", user.id).order("created_at"),
        supabase.from("exercises").select("*").eq("user_id", user.id).order("name"),
      ]);
      const gymList = gymsRes.data ?? [];
      setGyms(gymList);
      setExercises((exRes.data ?? []) as Exercise[]);
      if (gymList.length > 0) setActiveGymId(gymList[0].id);
      await Promise.all([fetchWeeklyVolume(user.id), fetchHealth7d(user.id)]);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = useCallback(async (exId: string) => {
    const { data } = await supabase
      .from("workout_sets")
      .select("id, weight_kg, reps, rpe, est_1rm, logged_at, log_date")
      .eq("exercise_id", exId)
      .order("logged_at", { ascending: false })
      .limit(80);
    setHistory((data ?? []) as WorkoutSet[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeExId) { setHistory([]); return; }
    fetchHistory(activeExId);
    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "workout_sets",
        filter: `exercise_id=eq.${activeExId}`,
      }, () => fetchHistory(activeExId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExId]);

  const logSet = useCallback(async (weightKg: number, reps: number, rpe?: number) => {
    if (!userId || !activeExId || !activeGymId) return;
    const est1rm = Math.round(weightKg * (1 + reps / 30));
    const today  = new Date().toISOString().split("T")[0];
    await supabase.from("workout_sets").insert({
      user_id: userId, exercise_id: activeExId, gym_id: activeGymId,
      split_day: activeDay, weight_kg: weightKg, reps,
      rpe: rpe ?? null, est_1rm: est1rm, log_date: today,
    });
    await fetchHistory(activeExId);
    if (userId) fetchWeeklyVolume(userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeExId, activeGymId, activeDay, fetchHistory, fetchWeeklyVolume]);

  const deleteSet = useCallback(async (id: string) => {
    await supabase.from("workout_sets").delete().eq("id", id);
    if (activeExId) await fetchHistory(activeExId);
    if (userId) fetchWeeklyVolume(userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExId, fetchHistory, fetchWeeklyVolume, userId]);

  const today        = new Date().toISOString().split("T")[0];
  const sessions     = groupIntoSessions(history);
  const todaySets    = history.filter((s) => s.log_date === today);
  const pastSessions = sessions.filter((s) => s.date !== today);
  const filteredExercises = exercises.filter((e) => e.split_day === activeDay);
  const activeExercise    = exercises.find((e) => e.id === activeExId) ?? null;

  // ── Recovery + strain computation ─────────────────────────────────────
  // ONLY use today's row. Previously this fell back to the last record in the
  // 7-day window, which meant "no Oura data today" silently surfaced yesterday's
  // recovery as if it were today's — misleading on days the ring hadn't synced.
  const todayHealth = health7d.find((h) => h.date === today) ?? null;
  const hrv7d = health7d.map((h) => h.hrv).filter((v): v is number => v != null);
  const hrv7dAvg = hrv7d.length > 0 ? hrv7d.reduce((a, b) => a + b, 0) / hrv7d.length : null;

  // computeRecoveryScore returns null when its inputs are all empty, so even
  // a stale partial-row today (e.g. Oura inserted a row with no scores)
  // correctly surfaces as "no data" instead of a fabricated 50.
  const recovery: RecoveryResult | null = todayHealth
    ? computeRecoveryScore(todayHealth, hrv7dAvg)
    : null;

  const sessionStrain = computeSessionStrain(todaySets.map((s) => ({
    weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe,
  })));

  // Build muscle-set rows from weekly data for fatigue lookup
  const recentMuscleSets: MuscleSetRow[] = weeklyRaw.map((r) => ({
    logged_at: r.logged_at,
    weight_kg: r.weight_kg,
    reps:      r.reps,
    rpe:       r.rpe,
    muscles:   r.muscle_targets.length > 0 ? r.muscle_targets : [r.muscle_group],
  }));

  const primaryMuscle = activeExercise?.muscle_group ?? null;
  const muscleStatus: MuscleFatigueResult | null = primaryMuscle
    ? muscleFatigue(primaryMuscle, recentMuscleSets)
    : null;

  // Base verdict from history, then layer on recovery adjustment
  const baseVerdict = activeExercise
    ? analyze(pastSessions, activeExercise.exercise_type ?? "Secondary", activeExercise.name)
    : null;

  let verdict = baseVerdict;
  if (baseVerdict && recovery && muscleStatus) {
    const base: Prescription = {
      targetWeight: baseVerdict.targetWeight,
      targetReps:   baseVerdict.targetReps,
      targetSets:   baseVerdict.targetSets,
      rpeCap:       baseVerdict.rpeCap,
    };
    const adjustment = adjustForRecovery(base, recovery, muscleStatus);
    verdict = {
      ...baseVerdict,
      targetWeight: adjustment.adjusted.targetWeight,
      targetReps:   adjustment.adjusted.targetReps,
      targetSets:   adjustment.adjusted.targetSets,
      rpeCap:       adjustment.adjusted.rpeCap,
      recoveryAdjustment: adjustment,
    };
  }

  const trendData = [...pastSessions].reverse().slice(-10).map((s, i) => ({
    session: i + 1, est1rm: s.topEst1rm, weight: s.bestSet.weight_kg,
  }));

  // Compute weekly volume + frequency per muscle group
  const weeklyVolume: MuscleVolume[] = Object.entries(VOLUME_TARGETS).map(([muscle, target]) => {
    const rows = weeklyRaw.filter((r) => r.muscle_group === muscle);
    const sets = rows.length;
    const frequency = new Set(rows.map((r) => r.log_date)).size;
    const status: MuscleVolume["status"] =
      sets < target.min ? "under" : sets > target.max ? "over" : "optimal";
    return { muscle, sets, frequency, target, status };
  });

  return {
    gyms, filteredExercises, exercises, sessions, pastSessions, todaySets, trendData,
    weeklyVolume, loading,
    activeGymId, setActiveGymId,
    activeDay,   setActiveDay,
    activeExId,  setActiveExId,
    activeExercise, verdict, logSet, deleteSet,
    recovery, sessionStrain, muscleStatus,
  };
}
