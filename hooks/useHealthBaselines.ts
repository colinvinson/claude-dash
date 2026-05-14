"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeBaselines, type BaselinesMap, type HealthRow } from "@/lib/jarvis/baselines";

// 30-day rolling biometric baselines (mean + stddev per metric) for use in
// scoring and any UI surface that wants to phrase today's numbers relative
// to the user's own norm.

function dateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export function useHealthBaselines() {
  const [baselines, setBaselines] = useState<BaselinesMap>({});
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("health_logs")
        .select("readiness_score, hrv, rhr, sleep_score, sleep_hours, deep_min, rem_min")
        .eq("user_id", user.id)
        .gte("date", dateDaysAgo(30));

      if (cancelled) return;
      setBaselines(computeBaselines((data ?? []) as HealthRow[]));
      setLoading(false);
    })().catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { baselines, loading };
}
