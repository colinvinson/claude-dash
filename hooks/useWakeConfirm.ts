"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

// Wake-confirm: today's status + 14-day streak of on-time wake-ups.
// Hits `wake_logs`, which is written either by /api/wake-confirm (NFC
// tap from Alarmy dismiss) or by the manual confirm button below.

export type WakeLog = {
  id:        string;
  date:      string;       // YYYY-MM-DD
  wake_at:   string;       // ISO timestamp
  target_at: string | null;
  on_time:   boolean | null;
  source:    string;
};

function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function useWakeConfirm() {
  const supabase = createClient();
  const [userId, setUserId]       = useState<string | null>(null);
  const [today,  setToday]        = useState<WakeLog | null>(null);
  const [recent, setRecent]       = useState<WakeLog[]>([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async (uid: string) => {
    const date = todayLocalDate();
    const [todayRes, recentRes] = await Promise.all([
      supabase.from("wake_logs").select("*").eq("user_id", uid).eq("date", date).maybeSingle(),
      supabase.from("wake_logs").select("*").eq("user_id", uid).gte("date", dateDaysAgo(14)).order("date", { ascending: false }),
    ]);
    setToday((todayRes.data as WakeLog | null) ?? null);
    setRecent((recentRes.data as WakeLog[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      await load(user.id);
    })();
  }, [supabase, load]);

  useRealtimeSubscription({
    channelBase: userId ? `wake_logs:${userId}` : "",
    table: "wake_logs",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onChange: () => { if (userId) load(userId); },
  });

  // Manual confirm — for the rare day the NFC path doesn't fire (forgotten
  // phone in the kitchen, tag damaged, etc.). Computes target_at + on_time
  // client-side from the profile's wake_target_time.
  const confirmNow = useCallback(async () => {
    if (!userId) return;
    const now = new Date();
    const date = todayLocalDate();
    const { data: profile } = await supabase
      .from("profiles").select("wake_target_time").eq("id", userId).single();
    const targetTime = (profile?.wake_target_time as string | undefined) ?? "07:30:00";
    const [hh, mm, ss] = targetTime.split(":").map(Number);
    const targetAt = new Date(now);
    targetAt.setHours(hh ?? 7, mm ?? 30, ss ?? 0, 0);
    await supabase.from("wake_logs").upsert({
      user_id:   userId,
      date,
      wake_at:   now.toISOString(),
      target_at: targetAt.toISOString(),
      on_time:   now.getTime() <= targetAt.getTime(),
      source:    "manual",
    }, { onConflict: "user_id,date", ignoreDuplicates: true });
    await load(userId);
  }, [userId, supabase, load]);

  // 14-day on-time streak — counts consecutive most-recent days with
  // a wake_log where on_time === true. Missing days break the streak.
  let streak = 0;
  for (let i = 0; i < 14; i += 1) {
    const d = dateDaysAgo(i);
    const log = recent.find((r) => r.date === d);
    if (log?.on_time) streak += 1;
    else break;
  }

  return { today, recent, streak, confirmNow, loading };
}
