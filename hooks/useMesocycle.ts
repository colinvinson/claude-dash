"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getMesoState,
  type MesocycleRow,
  type MesoState,
  type MusclePriority,
} from "@/lib/fitness/mesocycle";

export type { MesocycleRow, MesoState, MusclePriority } from "@/lib/fitness/mesocycle";

const DEFAULT_PLANNED_WEEKS = 5;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(yyyymmdd: string, days: number): string {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function useMesocycle() {
  const supabase = createClient();
  const [userId,  setUserId]  = useState<string | null>(null);
  const [active,  setActive]  = useState<MesocycleRow | null>(null);
  const [state,   setState]   = useState<MesoState | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(`meso-${Math.random().toString(36).slice(2)}`);

  // Auto-create a new block. Carries the prior block's muscle_priorities
  // forward so weak-point markings persist across blocks (specializing the
  // rear delts in block 3 doesn't reset to nothing when block 4 starts).
  const autoCreate = useCallback(async (uid: string, opts?: {
    startDate?: string;
    carryPriorities?: Record<string, MusclePriority>;
    plannedWeeks?: number;
  }) => {
    await supabase.from("mesocycles").insert({
      user_id:           uid,
      start_date:        opts?.startDate ?? todayStr(),
      planned_weeks:     opts?.plannedWeeks ?? DEFAULT_PLANNED_WEEKS,
      muscle_priorities: opts?.carryPriorities ?? {},
    });
  }, [supabase]);

  // Resolve the active block for today:
  //   1. If an active block exists and is still in progress → use it.
  //   2. If an active block exists but its planned weeks are up → end it and
  //      auto-roll a new one starting the day after (or today if longer ago).
  //   3. If no active block AND Sir has ever logged a workout set → auto-
  //      create starting today.
  //   4. Otherwise (no training history at all) → return null, the card shows
  //      an empty state.
  const fetchActive = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("mesocycles")
      .select("id, user_id, start_date, planned_weeks, muscle_priorities, notes, ended_at, created_at")
      .eq("user_id", uid)
      .is("ended_at", null)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let row = (data as MesocycleRow | null) ?? null;
    let derived: MesoState | null = row ? getMesoState(row, todayStr()) : null;

    if (row && derived && derived.phase === "complete") {
      // Block ran past its planned weeks. End it, roll a new one starting the
      // day after the previous block's last week. If that "next start" is in
      // the past (Sir was away), snap to today so week 1 is fresh.
      const prevLastDay = addDays(row.start_date, row.planned_weeks * 7 - 1);
      let nextStart = addDays(prevLastDay, 1);
      if (nextStart < todayStr()) nextStart = todayStr();
      await supabase.from("mesocycles").update({ ended_at: new Date().toISOString() }).eq("id", row.id);
      await autoCreate(uid, {
        startDate:       nextStart,
        carryPriorities: row.muscle_priorities,
        plannedWeeks:    row.planned_weeks,
      });
      const refetch = await supabase
        .from("mesocycles")
        .select("id, user_id, start_date, planned_weeks, muscle_priorities, notes, ended_at, created_at")
        .eq("user_id", uid)
        .is("ended_at", null)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      row = (refetch.data as MesocycleRow | null) ?? null;
      derived = row ? getMesoState(row, todayStr()) : null;
    } else if (!row) {
      // Only auto-create if there's any training history — otherwise we'd
      // spawn a phantom block for someone who never lifts.
      const { count } = await supabase
        .from("workout_sets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);
      if ((count ?? 0) > 0) {
        await autoCreate(uid);
        const refetch = await supabase
          .from("mesocycles")
          .select("id, user_id, start_date, planned_weeks, muscle_priorities, notes, ended_at, created_at")
          .eq("user_id", uid)
          .is("ended_at", null)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        row = (refetch.data as MesocycleRow | null) ?? null;
        derived = row ? getMesoState(row, todayStr()) : null;
      }
    }

    setActive(row);
    setState(derived);
  }, [supabase, autoCreate]);

  useEffect(() => {
    let uid = "";
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      uid = user.id;
      setUserId(uid);
      await fetchActive(uid);
      setLoading(false);
    }
    init();

    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "mesocycles" }, () => {
        if (uid) fetchActive(uid);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update muscle priorities on the active mesocycle (mark muscles as
  // specialize / maintenance, or clear). Auto-carried to future blocks.
  const setPriority = useCallback(async (muscle: string, priority: MusclePriority | null) => {
    if (!userId || !active) return;
    const next = { ...active.muscle_priorities };
    if (priority == null) delete next[muscle];
    else                  next[muscle] = priority;
    await supabase.from("mesocycles").update({ muscle_priorities: next }).eq("id", active.id);
    await fetchActive(userId);
  }, [userId, active, supabase, fetchActive]);

  return { active, state, loading, setPriority };
}
