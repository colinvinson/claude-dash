"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkout, VOLUME_TARGETS } from "@/hooks/useWorkout";
import { evaluateOptimizations, type Recommendation } from "@/lib/fitness/optimization-engine";
import type { SplitStats } from "@/lib/fitness/optimization-rules";

export function useOptimization() {
  const supabase = createClient();
  const { exercises, weeklyVolume, activeGymId, gyms } = useWorkout();

  const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);

  // Load active gym's equipment + dismissed recs.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Available equipment from the ACTIVE gym (if any).
      if (activeGymId) {
        const { data } = await supabase
          .from("gym_locations")
          .select("available_equipment")
          .eq("id", activeGymId)
          .maybeSingle();
        if (!cancelled) setAvailableEquipment((data?.available_equipment as string[] | null) ?? []);
      } else {
        if (!cancelled) setAvailableEquipment([]);
      }

      // Dismissed recommendation ids.
      const { data: dRows } = await supabase
        .from("coach_dismissals")
        .select("rec_id")
        .eq("user_id", user.id);
      if (!cancelled) {
        setDismissed(new Set(((dRows ?? []) as Array<{ rec_id: string }>).map((r) => r.rec_id)));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGymId]);

  // Build split stats from weeklyVolume.
  const splitStats: SplitStats = useMemo(() => {
    const freqByMuscle:  Record<string, number> = {};
    const setsByMuscle:  Record<string, number> = {};
    for (const v of weeklyVolume) {
      freqByMuscle[v.muscle] = v.frequency;
      setsByMuscle[v.muscle] = v.sets;
    }
    // splitDays = unique non-null split_day values from exercises Sir has set up
    const splitDays = Array.from(new Set(exercises.map((e) => e.split_day).filter(Boolean)));
    return { freqByMuscle, setsByMuscle, splitDays };
  }, [weeklyVolume, exercises]);

  // True iff Sir has logged ANY set in the last 7 days. The engine itself
  // also gates on this; surfacing it lets the UI distinguish "all clear"
  // (nothing to flag) from "no history yet" (don't even try yet).
  const hasTrainingHistory = useMemo(
    () => Object.values(splitStats.setsByMuscle).reduce((s, n) => s + n, 0) > 0,
    [splitStats],
  );

  const recommendations = useMemo<Recommendation[]>(() => {
    if (loading) return [];
    return evaluateOptimizations({
      exercises: exercises.map((e) => ({ id: e.id, name: e.name, muscle_group: e.muscle_group })),
      availableEquipment,
      splitStats,
      dismissedRecIds: dismissed,
    });
  }, [loading, exercises, availableEquipment, splitStats, dismissed]);

  // Mark a recommendation as dismissed (writes through to the table).
  const dismissRec = useCallback(async (recId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setDismissed((prev) => new Set(prev).add(recId));
    await supabase.from("coach_dismissals").upsert({ user_id: user.id, rec_id: recId });
  }, [supabase]);

  // Apply a swap: update the exercise row's name in-place. The user keeps
  // their training history (workout_sets.exercise_id stays the same).
  const applySwap = useCallback(async (exerciseId: string, newName: string) => {
    await supabase.from("exercises").update({ name: newName }).eq("id", exerciseId);
  }, [supabase]);

  // Save equipment changes for the active gym.
  const setEquipment = useCallback(async (next: string[]) => {
    if (!activeGymId) return;
    setAvailableEquipment(next);
    await supabase.from("gym_locations").update({ available_equipment: next }).eq("id", activeGymId);
  }, [activeGymId, supabase]);

  // Convenience helpers passed through for the equipment editor UI.
  const activeGymName = gyms.find((g) => g.id === activeGymId)?.name ?? null;

  return {
    loading,
    recommendations,
    availableEquipment,
    activeGymId,
    activeGymName,
    splitStats,
    hasTrainingHistory,
    volumeTargets: VOLUME_TARGETS,
    setEquipment,
    dismissRec,
    applySwap,
  };
}
