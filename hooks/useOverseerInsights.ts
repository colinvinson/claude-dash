"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type OverseerInsight = {
  id: string;
  body: string;
  severity: "green" | "yellow" | "red";
  triggered_at: string;
  dismissed_at: string | null;
};

export function useOverseerInsights() {
  const supabase = createClient();
  const [insights, setInsights] = useState<OverseerInsight[]>([]);
  const channelRef = useRef(`overseer-insights-${Math.random().toString(36).slice(2)}`);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("overseer_insights")
      .select("id, body, severity, triggered_at, dismissed_at")
      .eq("user_id", user.id)
      .is("dismissed_at", null)
      .order("triggered_at", { ascending: false })
      .limit(5);
    setInsights((data ?? []) as OverseerInsight[]);
  }, [supabase]);

  const dismiss = useCallback(async (id: string) => {
    await supabase
      .from("overseer_insights")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "overseer_insights" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  return { insights, dismiss };
}
