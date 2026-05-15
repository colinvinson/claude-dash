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
  type ProteinDeficit,
} from "@/lib/fitness/recovery";
import { buildSetProtocol, buildWarmupSets, type SetProtocol, type WarmupSet } from "@/lib/fitness/intensity-protocol";
import { getMesoState, targetForMuscle, type MesocycleRow, type MesoState } from "@/lib/fitness/mesocycle";
import { buildLifestyleContext, type LifestyleContext, type Driver } from "@/lib/fitness/lifestyle-drivers";
import { kgToLb } from "@/lib/units";

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

export type CoachStatus = "NEW" | "PROGRESS" | "GRIND" | "STALLING" | "REGRESSION" | "DELOAD";

export type CoachVerdict = {
  status: CoachStatus;
  targetWeight: number;
  targetReps: number;
  targetSets: number;
  rpeCap: number | null;
  repRange: { min: number; max: number };
  headline: string;
  tip: string;
  recoveryAdjustment: Adjustment | null;
  // Per-set RIR + technique guidance, derived from exerciseType + status +
  // recovery. Populated by useWorkout after computePrescription returns.
  setProtocol: SetProtocol[];
  // Warmup sets to do BEFORE the working sets. Scaled to target weight by
  // exercise type (compounds get a 3-step ramp; isolations get 0-1 sets).
  warmupSets: WarmupSet[];
  // Cross-cutting context that affects progress: sleep, alcohol, supplement
  // adherence, composition phase. The verdict's STATUS comes from training
  // history, but these drivers explain WHY it landed there.
  lifestyleDrivers: Driver[];
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
  target: { min: number; max: number };   // MEV-MRV envelope (static science-based)
  weekTarget: number;                       // THIS week's specific set target (mesocycle-aware)
  status: "under" | "optimal" | "over";   // legacy band vs MEV-MRV envelope
  weekStatus: "below" | "near" | "at-or-over"; // vs weekTarget
  priority: "normal" | "specialize" | "maintenance";
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
      headline: `First session — start at ${kgToLb(startWeight).toFixed(0)} lb`,
      tip: `${isCompound ? "Compounds build the foundation. " : isIsolation ? "Focus on the squeeze, not the weight. " : ""}Nail form before adding load. Hit ${repRange.min}–${repRange.max} reps clean.`,
      recoveryAdjustment: null,
      setProtocol: [],
      warmupSets: [],
      lifestyleDrivers: [],
    };
  }

  const last = pastSessions[0].bestSet;
  const prev = pastSessions[1]?.bestSet ?? null;

  // Regression: est_1RM down >5% vs previous session
  if (prev && last.est_1rm < prev.est_1rm * 0.95) {
    return {
      status: "REGRESSION", targetWeight: prev.weight_kg, targetReps: repRange.min, targetSets: 3, rpeCap: 8, repRange,
      headline: `Step back to ${kgToLb(prev.weight_kg).toFixed(0)} lb — strength dropped`,
      tip: "Est. 1RM fell >5%. Return to last good weight and rebuild. Check sleep quality, caloric intake, and weekly volume — you may be overreaching.",
      recoveryAdjustment: null,
      setProtocol: [],
      warmupSets: [],
      lifestyleDrivers: [],
    };
  }

  // Progress: hit top of rep range → add weight
  if (last.reps >= repRange.max) {
    const increment = isCompound ? 2.5 : 1.25;
    const next = Math.round((last.weight_kg + increment) * 100) / 100;
    return {
      status: "PROGRESS", targetWeight: next, targetReps: repRange.min, targetSets: 3, rpeCap: null, repRange,
      headline: `Load up — ${kgToLb(next).toFixed(0)} lb, aim for ${repRange.min} reps`,
      tip: `You hit ${last.reps} reps at ${kgToLb(last.weight_kg).toFixed(0)} lb. Add ${kgToLb(increment).toFixed(1)} lb and grind back up to ${repRange.max}. ${isIsolation ? "Keep tension on the muscle throughout." : isCompound ? "Same technique, new weight." : ""}`,
      recoveryAdjustment: null,
      setProtocol: [],
      warmupSets: [],
      lifestyleDrivers: [],
    };
  }

  // Stalling: same weight, no rep gain over 3 sessions
  if (pastSessions.length >= 3) {
    const recent = pastSessions.slice(0, 3).map((s) => s.bestSet);
    const stalled =
      recent.every((s) => s.weight_kg === recent[0].weight_kg) &&
      recent[0].reps <= recent[2].reps;

    if (stalled) {
      return {
        status: "STALLING", targetWeight: last.weight_kg, targetReps: last.reps, targetSets: 3, rpeCap: null, repRange,
        headline: `Plateau at ${kgToLb(last.weight_kg).toFixed(0)} lb — push harder`,
        tip: `3 sessions at ${kgToLb(last.weight_kg).toFixed(0)} lb with no rep gain. Try drop-sets: after your top set, strip ${Math.round(kgToLb(last.weight_kg) * 0.15)} lb and hit a full AMRAP with no rest. Metabolic overload breaks plateaus.`,
        recoveryAdjustment: null,
        setProtocol: [],
        warmupSets: [],
        lifestyleDrivers: [],
      };
    }
  }

  // Grind: in range, push for more reps
  return {
    status: "GRIND", targetWeight: last.weight_kg, targetReps: Math.min(last.reps + 1, repRange.max), targetSets: 3, rpeCap: null, repRange,
    headline: `${kgToLb(last.weight_kg).toFixed(0)} lb — push for ${Math.min(last.reps + 1, repRange.max)}+ reps`,
    tip: `Last best: ${last.reps} reps. You need ${repRange.max} to unlock the next weight. ${isIsolation ? "Slow 3-second eccentric — time under tension drives growth." : isCompound ? "Control the descent, explode up." : ""}`,
    recoveryAdjustment: null,
    setProtocol: [],
    warmupSets: [],
    lifestyleDrivers: [],
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
  const [proteinDeficit, setProteinDeficit] = useState<ProteinDeficit | null>(null);
  const [mesocycle,     setMesocycle]     = useState<MesocycleRow | null>(null);
  const [lifestyleCtx,  setLifestyleCtx]  = useState<LifestyleContext | null>(null);
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

  // 7-day protein deficit: # of days under 70% of target. Target = latest
  // logged bodyweight × 2 g/kg (matches useProtein default).
  const fetchProtein7d = useCallback(async (uid: string) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const [logsRes, weightRes] = await Promise.all([
      supabase.from("protein_logs").select("protein_g, log_date").eq("user_id", uid).gte("log_date", cutoffStr),
      supabase.from("weight_logs").select("weight_kg").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1),
    ]);

    const latestWeight = (weightRes.data as Array<{ weight_kg: number }> | null)?.[0]?.weight_kg ?? null;
    const targetG = latestWeight ? Math.round(latestWeight * 2.0) : 150;
    const threshold = targetG * 0.7;

    // Sum per-day grams across the last 7 calendar days.
    const byDate = new Map<string, number>();
    for (const row of (logsRes.data ?? []) as Array<{ protein_g: number; log_date: string }>) {
      byDate.set(row.log_date, (byDate.get(row.log_date) ?? 0) + Number(row.protein_g));
    }

    let daysUnder = 0;
    let totalG = 0;
    let daysCounted = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const grams = byDate.get(key) ?? 0;
      totalG += grams;
      daysCounted += 1;
      if (grams < threshold) daysUnder += 1;
    }
    const avgG = daysCounted > 0 ? totalG / daysCounted : 0;
    setProteinDeficit({ daysUnder, targetG, avgG });
  }, [supabase]);

  // Cross-cutting context that flows into the verdict text + REGRESSION gate.
  // Pulls: 7d alcohol, 7d supplement logs, 21d weight + sets + protein for
  // composition phase derivation.
  const fetchLifestyle = useCallback(async (uid: string) => {
    const day7  = new Date(); day7.setDate(day7.getDate() - 7);
    const day21 = new Date(); day21.setDate(day21.getDate() - 21);
    const d7  = day7.toISOString().slice(0, 10);
    const d21 = day21.toISOString().slice(0, 10);

    const [alcoholRes, suppLogsRes, activeStackRes, weightRes, latestWeightRes, sets21Res, protein21Res, health7Res] = await Promise.all([
      supabase.from("alcohol_logs").select("log_date, drink_count").eq("user_id", uid).gte("log_date", d7),
      supabase.from("supplement_logs").select("supplement_id").eq("user_id", uid).gte("log_date", d7),
      supabase.from("supplement_stack").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("is_active", true),
      supabase.from("weight_logs").select("weight_kg, logged_at").eq("user_id", uid).gte("logged_at", `${d21}T00:00:00`).order("logged_at", { ascending: true }),
      supabase.from("weight_logs").select("weight_kg").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1),
      supabase.from("workout_sets").select("est_1rm, log_date, exercise_id").eq("user_id", uid).gte("log_date", d21),
      supabase.from("protein_logs").select("protein_g, log_date").eq("user_id", uid).gte("log_date", d21),
      supabase.from("health_logs").select("sleep_hours, sleep_score").eq("user_id", uid).gte("date", d7).order("date", { ascending: true }),
    ]);

    const ctx = buildLifestyleContext({
      health7d:        (health7Res.data ?? []) as Array<{ sleep_hours: number | null; sleep_score: number | null }>,
      alcohol7d:       (alcoholRes.data ?? []) as Array<{ log_date: string; drink_count: number | null }>,
      suppLogs7d:      (suppLogsRes.data ?? []) as Array<{ supplement_id: string }>,
      activeStackCount: activeStackRes.count ?? 0,
      weight21d:       (weightRes.data ?? []) as Array<{ weight_kg: number; logged_at: string }>,
      sets21d:         (sets21Res.data ?? []) as Array<{ est_1rm: number; log_date: string; exercise_id: string }>,
      protein21d:      (protein21Res.data ?? []) as Array<{ protein_g: number; log_date: string }>,
      latestWeightKg:  (latestWeightRes.data as Array<{ weight_kg: number }> | null)?.[0]?.weight_kg ?? null,
    });
    setLifestyleCtx(ctx);
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
      // Active mesocycle (single row or none).
      const mesoRes = await supabase
        .from("mesocycles")
        .select("id, user_id, start_date, planned_weeks, muscle_priorities, notes, ended_at, created_at")
        .eq("user_id", user.id)
        .is("ended_at", null)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      setMesocycle((mesoRes.data as MesocycleRow | null) ?? null);

      await Promise.all([fetchWeeklyVolume(user.id), fetchHealth7d(user.id), fetchProtein7d(user.id), fetchLifestyle(user.id)]);
      setLoading(false);
    }
    load();

    // Realtime subscription so a freshly started/ended meso flips the
    // coach + weekly-volume targets without a page refresh.
    const mesoChannel = supabase
      .channel(`workout-meso-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mesocycles" }, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const r = await supabase
          .from("mesocycles")
          .select("id, user_id, start_date, planned_weeks, muscle_priorities, notes, ended_at, created_at")
          .eq("user_id", user.id)
          .is("ended_at", null)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        setMesocycle((r.data as MesocycleRow | null) ?? null);
      })
      .subscribe();
    return () => { supabase.removeChannel(mesoChannel); };
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
  const rawRecovery: RecoveryResult | null = todayHealth
    ? computeRecoveryScore(todayHealth, hrv7dAvg)
    : null;

  // Layer chronic-protein-deficit driver onto recovery.drivers (visible in
  // the Recovery card + Jarvis context) without changing the autonomic score.
  const recovery: RecoveryResult | null = rawRecovery && proteinDeficit && proteinDeficit.daysUnder >= 3
    ? {
        ...rawRecovery,
        drivers: [
          ...rawRecovery.drivers,
          `Protein ${proteinDeficit.daysUnder}/7 days under-target (avg ${Math.round(proteinDeficit.avgG)}g vs ${proteinDeficit.targetG}g)`,
        ],
      }
    : rawRecovery;

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
    const adjustment = adjustForRecovery(base, recovery, muscleStatus, proteinDeficit);
    verdict = {
      ...baseVerdict,
      targetWeight: adjustment.adjusted.targetWeight,
      targetReps:   adjustment.adjusted.targetReps,
      targetSets:   adjustment.adjusted.targetSets,
      rpeCap:       adjustment.adjusted.rpeCap,
      recoveryAdjustment: adjustment,
    };
  }

  // Mesocycle state for THIS day. Drives deload override + dynamic volume
  // targets below.
  const todayStr2 = new Date().toISOString().slice(0, 10);
  const mesoState: MesoState | null = mesocycle ? getMesoState(mesocycle, todayStr2) : null;

  // Deload override: when the active mesocycle is in its deload week, force a
  // half-volume / RIR-3 prescription regardless of what analyze() said. This
  // is the scheduled fatigue dump that keeps the program working long-term.
  if (verdict && mesoState?.isDeloadWeek) {
    const original = {
      targetWeight: verdict.targetWeight,
      targetReps:   verdict.targetReps,
      targetSets:   verdict.targetSets,
      rpeCap:       verdict.rpeCap,
    };
    const adjustedSets = Math.max(2, Math.floor(verdict.targetSets * 0.5));
    const deloadAdj: Adjustment = {
      applied: true,
      reason: `Deload week ${mesoState.currentWeek}/${mesocycle!.planned_weeks} — half volume, RIR 3, save the CNS`,
      original,
      adjusted: { ...original, targetSets: adjustedSets, rpeCap: 7 },
    };
    verdict = {
      ...verdict,
      status:        "DELOAD",
      targetSets:    adjustedSets,
      rpeCap:        7,
      headline:      `Deload week — half volume, easy weights`,
      tip:           `Week ${mesoState.currentWeek}/${mesocycle!.planned_weeks}. Cut volume, no PRs, no failure. Bank recovery so next block starts fresh.`,
      // Stack on top of any prior recovery adjustment.
      recoveryAdjustment: verdict.recoveryAdjustment ?? deloadAdj,
    };
  }

  // Attach per-set RIR + technique protocol AND warm-up scheme to the final
  // verdict. Both are computed after recovery + deload adjustment so they pick
  // up the adjusted set count + adjusted working weight respectively.
  if (verdict && activeExercise) {
    const exType = activeExercise.exercise_type ?? "Secondary";
    verdict = {
      ...verdict,
      setProtocol: buildSetProtocol(exType, verdict.status, verdict.targetSets, recovery?.band ?? null),
      warmupSets:  buildWarmupSets(exType, verdict.targetWeight),
    };
  }

  // Lifestyle integration. The coach's STATUS comes from training history,
  // but the verdict's text + REGRESSION trigger should reflect what's
  // happening AROUND the training (cut phase, sleep debt, alcohol, etc).
  //   - Cut phase: don't deload Sir for a 5% est-1RM drop when calories
  //     are intentionally low. Strength regression on a clean cut is the
  //     program working as designed.
  //   - Stalling/Grind: when there's a major lifestyle drag (sleep <6.5h
  //     or heavy alcohol week), the headline lies if it says "push harder."
  //     Layer the actual drivers in so Sir sees the real bottleneck.
  if (verdict && lifestyleCtx) {
    let nextVerdict = { ...verdict, lifestyleDrivers: lifestyleCtx.drivers };

    if (verdict.status === "REGRESSION" && lifestyleCtx.compositionTag === "clean-cut") {
      // Downgrade to GRIND with cut-appropriate framing.
      nextVerdict = {
        ...nextVerdict,
        status:   "GRIND",
        headline: `${kgToLb(verdict.targetWeight).toFixed(0)} lb — strength dip is the cut, not the program`,
        tip:      `Est. 1RM slipped — expected on a clean cut. Hold the weight, hit reps cleanly. Don't chase PRs in a deficit. ${lifestyleCtx.sleepHrs7dAvg && lifestyleCtx.sleepHrs7dAvg < 7 ? `Sleep ${lifestyleCtx.sleepHrs7dAvg.toFixed(1)}h avg — getting that up matters more than the weight on the bar right now.` : ""}`.trim(),
      };
    } else if ((verdict.status === "STALLING" || verdict.status === "GRIND") && lifestyleCtx.hasMajorDrag) {
      // The PLATEAU has a cause. Surface it instead of "push harder."
      const drag = lifestyleCtx.sleepHrs7dAvg != null && lifestyleCtx.sleepHrs7dAvg < 6.5
        ? `Sleep ${lifestyleCtx.sleepHrs7dAvg.toFixed(1)}h avg — that's the plateau cause.`
        : `${lifestyleCtx.drinks7dTotal} drinks across ${lifestyleCtx.alcoholDays7d} days — recovery is compromised. That's the plateau cause.`;
      nextVerdict = {
        ...nextVerdict,
        tip: `${drag} Push harder in the gym won't fix it; fix the recovery first.`,
      };
    }

    verdict = nextVerdict;
  }

  const trendData = [...pastSessions].reverse().slice(-10).map((s, i) => ({
    session: i + 1, est1rm: s.topEst1rm, weight: s.bestSet.weight_kg,
  }));

  // Weekly volume + frequency per muscle. `weekTarget` is mesocycle-aware:
  //   - With active meso: ramped target this week (or MEV×0.5 if deload week,
  //     or MRV if muscle is marked "specialize", or MEV if "maintenance").
  //   - No meso: fall back to MEV as the week target.
  // The static MEV-MRV envelope is still surfaced as `target` for UI.
  const weeklyVolume: MuscleVolume[] = Object.entries(VOLUME_TARGETS).map(([muscle, target]) => {
    const rows = weeklyRaw.filter((r) => r.muscle_group === muscle);
    const sets = rows.length;
    const frequency = new Set(rows.map((r) => r.log_date)).size;
    const status: MuscleVolume["status"] =
      sets < target.min ? "under" : sets > target.max ? "over" : "optimal";

    const weekTarget = mesoState && mesocycle
      ? targetForMuscle(muscle, target.min, target.max, mesoState, mesocycle.muscle_priorities, mesocycle.planned_weeks)
      : target.min;
    const weekStatus: MuscleVolume["weekStatus"] =
      sets >= weekTarget       ? "at-or-over" :
      sets >= weekTarget - 1   ? "near" :
                                 "below";
    const priority: MuscleVolume["priority"] =
      mesocycle?.muscle_priorities?.[muscle] === "specialize"  ? "specialize"  :
      mesocycle?.muscle_priorities?.[muscle] === "maintenance" ? "maintenance" :
                                                                 "normal";

    return { muscle, sets, frequency, target, weekTarget, status, weekStatus, priority };
  });

  return {
    gyms, filteredExercises, exercises, sessions, pastSessions, todaySets, trendData,
    weeklyVolume, loading,
    activeGymId, setActiveGymId,
    activeDay,   setActiveDay,
    activeExId,  setActiveExId,
    activeExercise, verdict, logSet, deleteSet,
    recovery, sessionStrain, muscleStatus,
    mesocycle, mesoState,
  };
}
