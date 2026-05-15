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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function useMesocycle() {
  const supabase = createClient();
  const [userId,  setUserId]  = useState<string | null>(null);
  const [active,  setActive]  = useState<MesocycleRow | null>(null);
  const [state,   setState]   = useState<MesoState | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(`meso-${Math.random().toString(36).slice(2)}`);

  const fetchActive = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("mesocycles")
      .select("id, user_id, start_date, planned_weeks, muscle_priorities, notes, ended_at, created_at")
      .eq("user_id", uid)
      .is("ended_at", null)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = (data as MesocycleRow | null) ?? null;
    setActive(row);
    setState(row ? getMesoState(row, todayStr()) : null);
  }, [supabase]);

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

  // Start a new mesocycle. Auto-ends the current active one (if any) so the
  // unique-active-per-user constraint is honored.
  const start = useCallback(async (args?: {
    plannedWeeks?: number;
    startDate?:    string;
    priorities?:   Record<string, MusclePriority>;
    notes?:        string;
  }) => {
    if (!userId) return;
    if (active) {
      await supabase.from("mesocycles").update({ ended_at: new Date().toISOString() }).eq("id", active.id);
    }
    await supabase.from("mesocycles").insert({
      user_id:           userId,
      start_date:        args?.startDate    ?? todayStr(),
      planned_weeks:     args?.plannedWeeks ?? 5,
      muscle_priorities: args?.priorities   ?? {},
      notes:             args?.notes        ?? null,
    });
    await fetchActive(userId);
  }, [userId, active, supabase, fetchActive]);

  const end = useCallback(async () => {
    if (!userId || !active) return;
    await supabase.from("mesocycles").update({ ended_at: new Date().toISOString() }).eq("id", active.id);
    await fetchActive(userId);
  }, [userId, active, supabase, fetchActive]);

  // Update muscle priorities on the active mesocycle (mark muscles as
  // specialize / maintenance, or clear).
  const setPriority = useCallback(async (muscle: string, priority: MusclePriority | null) => {
    if (!userId || !active) return;
    const next = { ...active.muscle_priorities };
    if (priority == null) delete next[muscle];
    else                  next[muscle] = priority;
    await supabase.from("mesocycles").update({ muscle_priorities: next }).eq("id", active.id);
    await fetchActive(userId);
  }, [userId, active, supabase, fetchActive]);

  return { active, state, loading, start, end, setPriority };
}
