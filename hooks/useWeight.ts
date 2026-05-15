"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  collapseToDaily,
  computeProteinAdherence,
  computeStrengthDeltaPct,
  deriveRecompVerdict,
  type RecompVerdict,
  type WeightPoint,
} from "@/lib/fitness/composition";

export type { RecompVerdict, WeightPoint } from "@/lib/fitness/composition";

export function useWeight(lookbackDays = 30) {
  const supabase = createClient();
  const [userId,  setUserId]  = useState<string | null>(null);
  const [points,  setPoints]  = useState<WeightPoint[]>([]);
  const [verdict, setVerdict] = useState<RecompVerdict | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(`weight-${Math.random().toString(36).slice(2)}`);

  const compute = useCallback(async (uid: string) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const [weightRes, latestWeightRes, setsRes, proteinRes] = await Promise.all([
      supabase
        .from("weight_logs")
        .select("weight_kg, logged_at")
        .eq("user_id", uid)
        .gte("logged_at", `${cutoffStr}T00:00:00`)
        .order("logged_at", { ascending: true }),
      supabase
        .from("weight_logs")
        .select("weight_kg")
        .eq("user_id", uid)
        .order("logged_at", { ascending: false })
        .limit(1),
      supabase
        .from("workout_sets")
        .select("est_1rm, log_date, exercise_id")
        .eq("user_id", uid)
        .gte("log_date", cutoffStr)
        .order("log_date", { ascending: true }),
      supabase
        .from("protein_logs")
        .select("protein_g, log_date")
        .eq("user_id", uid)
        .gte("log_date", cutoffStr),
    ]);

    const daily = collapseToDaily(
      (weightRes.data ?? []) as Array<{ weight_kg: number; logged_at: string }>,
    );
    setPoints(daily);

    const strengthDeltaPct = computeStrengthDeltaPct(
      (setsRes.data ?? []) as Array<{ est_1rm: number; log_date: string; exercise_id: string }>,
      lookbackDays,
    );

    const latestWeight = (latestWeightRes.data as Array<{ weight_kg: number }> | null)?.[0]?.weight_kg ?? null;
    const proteinAdherence = computeProteinAdherence(
      (proteinRes.data ?? []) as Array<{ protein_g: number; log_date: string }>,
      latestWeight,
      lookbackDays,
    );

    setVerdict(deriveRecompVerdict(daily, strengthDeltaPct, proteinAdherence));
  }, [supabase, lookbackDays]);

  useEffect(() => {
    let uid = "";
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      uid = user.id;
      setUserId(uid);
      await compute(uid);
      setLoading(false);
    }
    init();

    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "weight_logs" }, () => {
        if (uid) compute(uid);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logWeight = useCallback(async (weightKg: number) => {
    if (!userId) return;
    await supabase.from("weight_logs").insert({ user_id: userId, weight_kg: weightKg });
    await compute(userId);
  }, [userId, supabase, compute]);

  const currentKg = points.length > 0 ? points[points.length - 1].weight_kg : null;
  const prior7    = points.length >= 2
    ? (() => {
        const target = new Date();
        target.setDate(target.getDate() - 7);
        const ts = target.toISOString().slice(0, 10);
        const closest = points.reduce((best, p) =>
          Math.abs(p.date.localeCompare(ts)) < Math.abs(best.date.localeCompare(ts)) ? p : best,
          points[0],
        );
        return closest.weight_kg;
      })()
    : null;
  const delta7 = currentKg != null && prior7 != null ? currentKg - prior7 : null;

  return {
    points, verdict, currentKg, delta7, loading,
    logWeight,
  };
}
