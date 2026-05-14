"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StackItem } from "./useStack";

// Per-item adherence stats so the Schedule UI can show "are you on top of this?"
//
// Two numbers per item:
//   streak  — consecutive days the user logged the item, walking BACK from today,
//             skipping days where the item wasn't scheduled (per days_of_week).
//   ratio7d — # logged / # expected over the trailing 7-day window.

export type StackInsight = {
  itemId: string;
  streak: number;
  ratio7d: number;        // 0..1
  expected7d: number;
  done7d: number;
};

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

function isScheduledOn(item: StackItem, date: Date): boolean {
  if (!item.days_of_week || item.days_of_week.length === 0 || item.days_of_week.length === 7) return true;
  return item.days_of_week.includes(date.getDay());
}

export function useStackInsights(items: StackItem[]) {
  const [insights, setInsights] = useState<Record<string, StackInsight>>({});
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) { setInsights({}); setLoading(false); return; }

    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const today = new Date();
      // Walk back 60 days max — that's enough room for any realistic streak.
      const since = new Date(today);
      since.setDate(since.getDate() - 60);

      const { data: logs } = await supabase
        .from("supplement_logs")
        .select("supplement_id, log_date")
        .eq("user_id", user.id)
        .gte("log_date", ymd(since));

      // Index logs by (item, date) for O(1) lookups
      const byItem: Record<string, Set<string>> = {};
      for (const l of logs ?? []) {
        const k = String(l.supplement_id);
        if (!byItem[k]) byItem[k] = new Set();
        byItem[k].add(String(l.log_date));
      }

      const out: Record<string, StackInsight> = {};
      for (const item of items) {
        const logged = byItem[item.id] ?? new Set<string>();

        // Streak: walk back from today; for each day the item IS scheduled,
        // require it to be logged. Skip days it wasn't scheduled on.
        // Note: today not yet completed shouldn't break the streak, so if
        // today is scheduled and not logged, we still start counting from
        // yesterday — UNTIL it's late in the day. Simple rule: skip today
        // and start at yesterday.
        let streak = 0;
        for (let i = 1; i <= 60; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          if (!isScheduledOn(item, d)) continue;
          if (logged.has(ymd(d))) streak += 1;
          else break;
        }

        // 7d compliance: count expected days vs logged days in the last 7
        // (including today as an expected day if scheduled, since the user
        // can still log it).
        let expected = 0, done = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          if (!isScheduledOn(item, d)) continue;
          expected += 1;
          if (logged.has(ymd(d))) done += 1;
        }

        out[item.id] = {
          itemId: item.id,
          streak,
          ratio7d: expected === 0 ? 0 : done / expected,
          expected7d: expected,
          done7d: done,
        };
      }

      if (!cancelled) {
        setInsights(out);
        setLoading(false);
      }
    })().catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [items]);

  return { insights, loading };
}
