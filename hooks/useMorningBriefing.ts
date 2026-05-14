"use client";

import { useEffect, useState } from "react";
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

export function useMorningBriefing() {
  const supabase = createClient();
  const [body,    setBody]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const today = getLogDate();
      const { data: existing } = await supabase
        .from("morning_briefings")
        .select("body")
        .eq("user_id", user.id)
        .eq("log_date", today)
        .single();

      if (existing?.body) {
        if (!cancelled) {
          setBody(existing.body);
          setLoading(false);
        }
        return;
      }

      // No briefing for today yet — generate one
      try {
        const res = await fetch("/api/jarvis/briefing", { method: "POST" });
        if (!res.ok) throw new Error("generate failed");
        const data = await res.json() as { body: string };
        if (!cancelled) {
          setBody(data.body);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed");
          setLoading(false);
        }
      }
    }

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { body, loading, error };
}
