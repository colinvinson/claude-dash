"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

function getLogDate() {
  const now = new Date();
  if (now.getHours() < 6) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return y.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

export type HealthLog = {
  readiness_score:      number | null;
  readiness_label:      string | null;
  sleep_score:          number | null;
  sleep_hours:          number | null;
  activity_score:       number | null;
  hrv:                  number | null;
  rhr:                  number | null;
  spo2_pct:             number | null;
  resp_rate:            number | null;
  skin_temp_delta:      number | null;
  rem_min:              number | null;
  deep_min:             number | null;
  light_min:            number | null;
  awake_min:            number | null;
  todays_call_body:     string | null;
  todays_call_severity: "green" | "yellow" | "red" | null;
  is_final:             boolean;
};

const EMPTY: HealthLog = {
  readiness_score: null, readiness_label: null,
  sleep_score: null, sleep_hours: null,
  activity_score: null, hrv: null, rhr: null,
  spo2_pct: null, resp_rate: null, skin_temp_delta: null,
  rem_min: null, deep_min: null, light_min: null, awake_min: null,
  todays_call_body: null, todays_call_severity: null, is_final: false,
};

export function useHealth() {
  const [health,   setHealth]   = useState<HealthLog>(EMPTY);
  const [loading,  setLoading]  = useState(true);
  const [syncing,  setSyncing]  = useState(false);
  const supabase   = createClient();
  const channelRef = useRef(`health-${Math.random().toString(36).slice(2)}`);

  const fetchHealth = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("health_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("date", getLogDate())
      .single();
    setHealth(data ?? EMPTY);
    return data;
  }, [supabase]);

  useEffect(() => {
    let userId = "";

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      userId = user.id;

      const data = await fetchHealth(userId);
      setLoading(false);

      // Poll Oura if we have no data or it's not yet final
      if (!data || !data.is_final) {
        setSyncing(true);
        try {
          await fetch("/api/oura/poll", { method: "POST" });
          await fetchHealth(userId);
        } catch {
          // silently fail — user may not have OURA_PAT set yet
        } finally {
          setSyncing(false);
        }
      }
    }

    init();

    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "health_logs" }, () => {
        if (userId) fetchHealth(userId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { health, loading, syncing };
}
