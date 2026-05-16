"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type GoalMetric = {
  id:         string;
  user_id:    string;
  goal_id:    string;
  value:      number;
  note:       string | null;
  logged_at:  string;
};

// Quantitative goal metric log. Used to chart progress toward a numeric
// target (testosterone level, body fat %, MRR, etc) and project an arrival
// date at the current rate.
export function useGoalMetrics(goalId: string | null) {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<GoalMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    if (!goalId) { setMetrics([]); setLoading(false); return; }
    const { data } = await supabase
      .from("goal_metrics")
      .select("*")
      .eq("goal_id", goalId)
      .order("logged_at", { ascending: true });
    setMetrics((data ?? []) as GoalMetric[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId]);

  useEffect(() => { load(); }, [load]);

  const logMetric = useCallback(async (value: number, note?: string) => {
    if (!userId || !goalId || !isFinite(value)) return null;
    const { data, error } = await supabase
      .from("goal_metrics")
      .insert({
        user_id:   userId,
        goal_id:   goalId,
        value,
        note:      note?.trim() || null,
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as GoalMetric;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, goalId, load]);

  const deleteMetric = useCallback(async (id: string) => {
    await supabase.from("goal_metrics").delete().eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Derived: latest value, change-rate per week, projected date to hit target.
  const stats = useMemo(() => {
    if (metrics.length === 0) {
      return { latest: null as number | null, ratePerWeek: 0, daysToTarget: null as number | null };
    }
    const latest = metrics[metrics.length - 1].value;
    if (metrics.length < 2) {
      return { latest, ratePerWeek: 0, daysToTarget: null };
    }
    // Linear regression for rate-per-week.
    const t0 = new Date(metrics[0].logged_at).getTime();
    const xs = metrics.map((m) => (new Date(m.logged_at).getTime() - t0) / 86400000);
    const ys = metrics.map((m) => m.value);
    const n = xs.length;
    const sumX  = xs.reduce((a, b) => a + b, 0);
    const sumY  = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
    const denom = n * sumXX - sumX * sumX;
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const ratePerWeek = slope * 7;
    return { latest, ratePerWeek, daysToTarget: null };
  }, [metrics]);

  // daysToTarget with a target injected by the caller (we don't have direct
  // access to the goal's target_value here — caller passes it in).
  const projectedDays = useCallback((targetValue: number): number | null => {
    if (stats.latest == null) return null;
    if (Math.abs(stats.ratePerWeek) < 0.0001) return null;
    const delta = targetValue - stats.latest;
    if (delta === 0) return 0;
    // Direction sanity: if we're rising but need to fall (or vice versa), no arrival.
    if (Math.sign(delta) !== Math.sign(stats.ratePerWeek)) return null;
    const weeks = delta / stats.ratePerWeek;
    return Math.round(weeks * 7);
  }, [stats]);

  return { metrics, loading, logMetric, deleteMetric, stats, projectedDays };
}
