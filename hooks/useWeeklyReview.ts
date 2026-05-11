"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function sundayStart(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split("T")[0];
}

export type Highlights = { prs: string[]; stalled: string[] };

export function useWeeklyReview() {
  const supabase = createClient();
  const [body,    setBody]    = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      const weekStart = sundayStart();
      const { data: existing } = await supabase
        .from("weekly_reviews")
        .select("body, highlights")
        .eq("user_id", user.id)
        .eq("week_start", weekStart)
        .single();

      if (existing?.body) {
        if (!cancelled) {
          setBody(existing.body);
          setHighlights((existing.highlights as Highlights) ?? null);
          setLoading(false);
        }
        return;
      }

      // Only auto-generate if it's Sunday AND it's after 8am
      const now = new Date();
      const isSunday = now.getDay() === 0;
      const isAfter8 = now.getHours() >= 8;
      if (!isSunday || !isAfter8) { if (!cancelled) setLoading(false); return; }

      try {
        const res = await fetch("/api/overseer/weekly-review", { method: "POST" });
        if (!res.ok) throw new Error("generate failed");
        const data = await res.json() as { body: string; highlights: Highlights };
        if (!cancelled) {
          setBody(data.body);
          setHighlights(data.highlights);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { body, highlights, loading };
}
