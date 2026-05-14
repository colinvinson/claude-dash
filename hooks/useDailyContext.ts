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

export type DailyContext = {
  id: string;
  log_date: string;
  raw_text: string;
  created_at: string;
};

export function useDailyContext() {
  const supabase = createClient();
  const [context, setContext] = useState<DailyContext | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(`daily-ctx-${Math.random().toString(36).slice(2)}`);

  const today = getLogDate();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("daily_context")
      .select("id, log_date, raw_text, created_at")
      .eq("user_id", user.id)
      .eq("log_date", today)
      .single();
    setContext(data as DailyContext | null);
    setLoading(false);
  }, [supabase, today]);

  const submit = useCallback(async (rawText: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("daily_context").upsert(
      { user_id: user.id, log_date: today, raw_text: rawText },
      { onConflict: "user_id,log_date" }
    );
    // Fire AI parse async — don't await
    fetch("/api/jarvis/parse-daily-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextText: rawText }),
    }).catch(() => {});
  }, [supabase, today]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_context" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  return {
    context,
    loading,
    hasCheckedIn: context !== null,
    submit,
  };
}
