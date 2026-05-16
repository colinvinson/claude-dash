"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import { Activity, Sparkles, Target, Heart, AlertTriangle, GitBranch } from "lucide-react";
import { PALETTE, TYPE, TINT, BORDER } from "@/lib/design-tokens";

type Insight = { id: string; kind: string; severity: string | null; body: string; triggered_at: string };

// Daily insight strip — shows up to 3 fresh insights from the
// daily-insights detector (performance / recovery / goal). Fires the
// detector on mount; reads jarvis_insights for today afterward.
//
// This is Jarvis being PROACTIVE — the dashboard's mission is one
// unified intelligence that surfaces patterns, not a passive log.

const KIND_META: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  performance: { label: "Performance",   icon: Activity,  color: PALETTE.success },
  recovery:    { label: "Recovery",      icon: Heart,     color: PALETTE.info },
  goal:        { label: "Goal",          icon: Target,    color: PALETTE.celebration },
  pb:          { label: "Personal best", icon: Sparkles,  color: PALETTE.celebration },
  correlation: { label: "Pattern",       icon: GitBranch, color: PALETTE.info },
  general:     { label: "Insight",       icon: Sparkles,  color: PALETTE.dim },
};

export default function DailyInsightStrip() {
  const supabase = createClient();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      // Fire both detectors. Both gate themselves server-side
      // (daily-insights once per kind per day, correlations once per week)
      // so refreshing the page is safe — no duplicate work or spam.
      await Promise.all([
        fetch("/api/jarvis/daily-insights", { method: "POST" }).catch(() => {}),
        fetch("/api/jarvis/correlations",    { method: "POST" }).catch(() => {}),
      ]);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setLoading(false); return; }
      // Show today's daily-insights + this-week's correlations (which
      // persist for ~7 days until the next pass).
      const today = new Date().toISOString().slice(0, 10);
      const wkAgo = new Date(); wkAgo.setDate(wkAgo.getDate() - 7);
      const [todayKindsRes, weekCorrelationsRes] = await Promise.all([
        supabase
          .from("jarvis_insights")
          .select("id, kind, severity, body, triggered_at")
          .eq("user_id", user.id)
          .in("kind", ["performance", "recovery", "goal", "pb"])
          .gte("triggered_at", `${today}T00:00:00`)
          .is("dismissed_at", null),
        supabase
          .from("jarvis_insights")
          .select("id, kind, severity, body, triggered_at")
          .eq("user_id", user.id)
          .eq("kind", "correlation")
          .gte("triggered_at", wkAgo.toISOString())
          .is("dismissed_at", null),
      ]);
      const merged = [
        ...((todayKindsRes.data ?? []) as Insight[]),
        ...((weekCorrelationsRes.data ?? []) as Insight[]),
      ].sort((a, b) => a.triggered_at.localeCompare(b.triggered_at));
      if (!cancelled) {
        setInsights(merged.slice(0, 5));
        setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function dismiss(id: string) {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("jarvis_insights").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
  }

  if (loading || insights.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className={`${TYPE.label} flex items-center gap-1`}>
          <Sparkles size={11} style={{ color: PALETTE.celebration }} />
          Jarvis insights · today
        </span>
        <span className="text-[10px] text-zinc-600">{insights.length}</span>
      </div>
      <div className="space-y-2">
        {insights.map((insight) => {
          const meta = KIND_META[insight.kind] ?? KIND_META.general;
          const Icon = meta.icon;
          const isWarn = insight.severity === "warn";
          const bg     = isWarn ? TINT.warning : TINT.success;
          const border = isWarn ? BORDER.warning : "rgba(255,255,255,0.06)";
          const accent = isWarn ? PALETTE.warning : meta.color;
          return (
            <div
              key={insight.id}
              className="rounded-xl px-3 py-2.5 flex items-start gap-2.5"
              style={{ background: isWarn ? bg : "rgba(255,255,255,0.04)", border: `1px solid ${border}` }}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isWarn
                  ? <AlertTriangle size={14} style={{ color: accent }} />
                  : <Icon size={14} style={{ color: accent }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-widest font-bold mb-0.5" style={{ color: accent }}>
                  {meta.label}
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed">{insight.body}</p>
              </div>
              <button
                onClick={() => dismiss(insight.id)}
                className="flex-shrink-0 text-zinc-600 hover:text-zinc-300 text-[10px] mt-0.5"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
