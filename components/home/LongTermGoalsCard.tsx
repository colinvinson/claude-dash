"use client";

import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { useLongTermGoals } from "@/hooks/useLongTermGoals";
import { Target } from "lucide-react";
import { PALETTE, TYPE } from "@/lib/design-tokens";

// Long-term goals on Home. Shows up to 3 FOCUS-flagged goals with progress
// bars + headline metric. Falls back to most-recently-created if nothing is
// flagged. Empty if no goals exist.
//
// Goals are the dashboard's reason for existing — they deserve a top-level
// surface on Home, not just a tab.

const MAX_FOCUS_GOALS = 3;

export default function LongTermGoalsCard() {
  const { goals, loading } = useLongTermGoals();

  if (loading) return null;

  if (goals.length === 0) {
    return (
      <Card>
        <span className={`${TYPE.label} block mb-2`}>— Long-term goals</span>
        <EmptyState
          icon={Target}
          title="No long-term goals yet"
          description={<>What are Sir actually moving toward? Open the <Link href="/life" className="text-zinc-300 underline">Life</Link> or <Link href="/businesses" className="text-zinc-300 underline">Businesses</Link> tab to set one.</>}
        />
      </Card>
    );
  }

  // Focus goals first (star-flagged), fallback to most-recent.
  const focusGoals = goals.filter((g) => g.is_focus).slice(0, MAX_FOCUS_GOALS);
  const display = focusGoals.length > 0 ? focusGoals : goals.slice(0, MAX_FOCUS_GOALS);
  const noFocus = focusGoals.length === 0 && goals.length > MAX_FOCUS_GOALS;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className={`${TYPE.label} flex items-center gap-1`}>
          <Star size={11} style={{ color: PALETTE.celebration }} fill={PALETTE.celebration} />
          {focusGoals.length > 0 ? "Focus goals" : "Long-term goals"}
        </span>
        <Link href="/life" className="text-[11px] text-zinc-500 hover:text-zinc-200 flex items-center gap-0.5">
          All <ChevronRight size={11} />
        </Link>
      </div>

      <div className="space-y-3">
        {display.map((g) => (
          <Link key={g.id} href={g.bucket === "business" ? "/businesses" : "/life"} className="block group">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white">
                  {g.title}
                </span>
                {g.bucket === "business" && (
                  <span className="text-[9px] uppercase tracking-widest text-zinc-600 flex-shrink-0">biz</span>
                )}
              </div>
              {g.goal_type === "quantitative" && g.target_value != null && (
                <span className="text-[11px] text-zinc-500 tabular-nums flex-shrink-0">
                  → {g.target_value}{g.metric_unit ? ` ${g.metric_unit}` : ""}
                </span>
              )}
            </div>
            {/* Progress bar — neutral indicator (real progress lives in the
                full widget on the Goals tab). Just signals "this is on your
                plate." */}
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  background: g.bucket === "business" ? PALETTE.info : PALETTE.success,
                  width: "100%",
                  opacity: 0.4,
                }}
              />
            </div>
            {g.current_state && (
              <p className="text-[10px] text-zinc-500 mt-1 italic truncate">{g.current_state}</p>
            )}
          </Link>
        ))}
      </div>

      {noFocus && (
        <p className="text-[10px] text-zinc-600 mt-3">
          Tip: tap the ⭐ on any goal in the Goals tab to flag it as focus — it&apos;ll show here.
        </p>
      )}
    </Card>
  );
}
