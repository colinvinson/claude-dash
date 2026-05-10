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

export type MeditationLog = {
  id: string;
  log_date: string;
  duration_min: number;
  logged_at: string;
};

export function useMeditation() {
  const supabase = createClient();
  const [logs, setLogs] = useState<MeditationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(`meditation-${Math.random().toString(36).slice(2)}`);

  const today = getLogDate();

  const todayMinutes = logs
    .filter((l) => l.log_date === today)
    .reduce((sum, l) => sum + l.duration_min, 0);

  // 7-day history: array of {date, minutes} for last 7 active days
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const minutes = logs
      .filter((l) => l.log_date === dateStr)
      .reduce((sum, l) => sum + l.duration_min, 0);
    return { date: dateStr, minutes };
  });

  // Streak: consecutive days ending at today with at least 1 session
  const streak = (() => {
    let count = 0;
    const logDates = new Set(logs.map((l) => l.log_date));
    const cursor = new Date();
    if (new Date().getHours() < 6) cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const ds = cursor.toISOString().split("T")[0];
      if (!logDates.has(ds)) break;
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  })();

  const fetchLogs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const { data } = await supabase
      .from("meditation_logs")
      .select("id, log_date, duration_min, logged_at")
      .eq("user_id", user.id)
      .gte("log_date", cutoff.toISOString().split("T")[0])
      .order("logged_at", { ascending: false });
    if (data) setLogs(data as MeditationLog[]);
    setLoading(false);
  }, [supabase]);

  const logSession = useCallback(async (durationMin: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("meditation_logs").insert({
      user_id: user.id,
      log_date: today,
      duration_min: durationMin,
    });
  }, [supabase, today]);

  const deleteLog = useCallback(async (id: string) => {
    await supabase.from("meditation_logs").delete().eq("id", id);
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "meditation_logs",
      }, fetchLogs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLogs, supabase]);

  return { logs, loading, todayMinutes, streak, last7, logSession, deleteLog };
}
