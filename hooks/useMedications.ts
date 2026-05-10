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

const VELO_LIMIT = 5;

export function useMedications() {
  const [concertaTaken,  setConcertaTaken]  = useState(false);
  const [concertaTakenAt, setConcertaTakenAt] = useState<string | null>(null);
  const [veloCount,      setVeloCount]      = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [userId,         setUserId]         = useState<string | null>(null);
  const supabase    = createClient();
  const channelRef  = useRef(`meds-${Math.random().toString(36).slice(2)}`);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const today = getLogDate();

    const { data: logs } = await supabase
      .from("medication_logs")
      .select("medication_type, taken_at")
      .eq("user_id", user.id)
      .eq("log_date", today);

    const concerta = (logs ?? []).find((l) => l.medication_type === "concerta");
    setConcertaTaken(!!concerta);
    setConcertaTakenAt(concerta?.taken_at ?? null);
    setVeloCount((logs ?? []).filter((l) => l.medication_type === "velo").length);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "medication_logs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logConcerta = useCallback(async () => {
    if (!userId || concertaTaken) return;
    const today = getLogDate();
    await supabase.from("medication_logs").insert({
      user_id: userId, medication_type: "concerta",
      log_date: today, taken_at: new Date().toISOString(),
    });
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, concertaTaken]);

  const adjustVelo = useCallback(async (delta: number) => {
    if (!userId) return;
    const today = getLogDate();
    if (delta > 0 && veloCount < VELO_LIMIT) {
      await supabase.from("medication_logs").insert({
        user_id: userId, medication_type: "velo",
        log_date: today, taken_at: new Date().toISOString(),
      });
    } else if (delta < 0 && veloCount > 0) {
      const { data } = await supabase
        .from("medication_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("log_date", today)
        .eq("medication_type", "velo")
        .order("taken_at", { ascending: false })
        .limit(1);
      if (data?.[0]) {
        await supabase.from("medication_logs").delete().eq("id", data[0].id);
      }
    }
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, veloCount]);

  return { concertaTaken, concertaTakenAt, veloCount, veloLimit: VELO_LIMIT, loading, logConcerta, adjustVelo };
}
