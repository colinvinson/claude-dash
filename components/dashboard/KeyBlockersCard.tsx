"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MilesCard from "@/components/dashboard/MilesCard";
import { PALETTE } from "@/lib/design-tokens";

// 06 // KEY BLOCKERS — left column bottom card.
// Top open work items across all of Rowan's "things to do" surfaces:
// business_tasks + open goal_milestones. Heat label (HOT / WARM)
// derived from due date + priority. "OWNER" line shows business name
// or "You" for milestones, plus stuck-duration since created_at.
//
// Single source of truth for "what's stuck" — pulls from existing
// tables instead of inventing another tracker.

type Blocker = {
  id:        string;
  title:     string;
  owner:     string;
  stuckDays: number;
  heat:      "HOT" | "WARM";
  href:      string;
};

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export default function KeyBlockersCard() {
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [tasksRes, milestonesRes, businessesRes] = await Promise.all([
        supabase.from("business_tasks")
          .select("id, title, priority, due_date, created_at, business_id")
          .eq("user_id", user.id)
          .eq("is_complete", false)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: true }),
        supabase.from("goal_milestones")
          .select("id, title, target_date, is_complete, created_at")
          .eq("user_id", user.id)
          .eq("is_complete", false)
          .order("target_date", { ascending: true, nullsFirst: false })
          .limit(20),
        supabase.from("businesses")
          .select("id, name")
          .eq("user_id", user.id),
      ]);

      if (cancelled) return;

      type TaskRow = { id: string; title: string; priority: number; due_date: string | null; created_at: string; business_id: string };
      type MilestoneRow = { id: string; title: string; target_date: string | null; is_complete: boolean; created_at: string };
      const bizName = new Map<string, string>(((businessesRes.data ?? []) as Array<{ id: string; name: string }>).map((b) => [b.id, b.name]));

      const taskItems: Blocker[] = ((tasksRes.data ?? []) as TaskRow[]).map((t) => {
        const stuckDays = daysSince(t.created_at);
        const overdue = t.due_date && new Date(t.due_date) < new Date();
        const heat: "HOT" | "WARM" = overdue || stuckDays >= 7 || (t.priority ?? 0) >= 2 ? "HOT" : "WARM";
        return {
          id:    t.id,
          title: t.title,
          owner: bizName.get(t.business_id) ?? "Biz",
          stuckDays,
          heat,
          href:  `/businesses/${t.business_id}`,
        };
      });

      const milestoneItems: Blocker[] = ((milestonesRes.data ?? []) as MilestoneRow[]).map((m) => {
        const stuckDays = daysSince(m.created_at);
        const overdue = m.target_date && new Date(m.target_date) < new Date();
        const heat: "HOT" | "WARM" = overdue || stuckDays >= 14 ? "HOT" : "WARM";
        return {
          id:    m.id,
          title: m.title,
          owner: "You",
          stuckDays,
          heat,
          href:  `/life`,
        };
      });

      const merged = [...taskItems, ...milestoneItems]
        .sort((a, b) => {
          if (a.heat !== b.heat) return a.heat === "HOT" ? -1 : 1;
          return b.stuckDays - a.stuckDays;
        });

      setBlockers(merged.slice(0, 5));
      setTotal(merged.length);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <MilesCard
      number="06"
      label="KEY BLOCKERS"
      right={
        <a href="/businesses" className="flex items-center gap-2 hover:text-zinc-300 transition-colors">
          <span className="tabular-nums">{total} ACTIVE</span>
          <span className="text-zinc-700">·</span>
          <span>VIEW ALL</span>
        </a>
      }
    >
      {loading ? (
        <div className="text-[11px] text-zinc-600 py-3 text-center">…</div>
      ) : blockers.length === 0 ? (
        <div className="text-[11px] text-zinc-600 italic py-3 text-center">
          Nothing stuck. Wide open.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {blockers.map((b) => (
            <a
              key={b.id}
              href={b.href}
              className="grid grid-cols-[1fr_auto] gap-3 items-start py-2.5 hover:bg-white/[0.02] -mx-2 px-2 rounded transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[12px] text-zinc-200 font-medium leading-snug line-clamp-2">
                  {b.title}
                </div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 font-semibold mt-1">
                  Owner {b.owner} · Stuck {b.stuckDays}d
                </div>
              </div>
              <HeatPill heat={b.heat} />
            </a>
          ))}
          {total > 5 && (
            <a href="/businesses" className="flex items-center justify-center pt-2.5 text-[10px] uppercase tracking-[0.18em] text-zinc-600 hover:text-zinc-300 font-semibold transition-colors">
              + {total - 5} more · view all
            </a>
          )}
        </div>
      )}
    </MilesCard>
  );
}

function HeatPill({ heat }: { heat: "HOT" | "WARM" }) {
  const color = heat === "HOT" ? PALETTE.danger : PALETTE.warning;
  return (
    <span
      className="inline-block text-[8px] uppercase tracking-[0.18em] font-bold px-1.5 py-0.5 rounded"
      style={{
        color,
        background: `${color}14`,
        border:     `1px solid ${color}40`,
      }}
    >
      {heat}
    </span>
  );
}
