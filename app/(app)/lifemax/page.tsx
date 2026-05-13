"use client";

import { useProtein } from "@/hooks/useProtein";
import { useJournal } from "@/hooks/useJournal";
import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";
import HealthCard from "@/components/health/HealthCard";
import DailyStack from "@/components/health/DailyStack";
import LongTermGoalsCard from "@/components/life/LongTermGoalsCard";

export default function LifeMaxPage() {
  const { totalToday, target, pctOfTarget } = useProtein();
  const { entries } = useJournal({ entryCategory: "personal" });

  const proteinColor =
    pctOfTarget >= 80 ? "#34d399" :
    pctOfTarget >= 50 ? "#fbbf24" :
                        "#a1a1aa";

  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <SectionLabel>LifeMax</SectionLabel>
      </div>

      {/* Oura biometrics */}
      <div className="anim-fade-up stagger-1">
        <HealthCard />
      </div>

      {/* Protein progress (read-only on this tab — log via +LOG) */}
      <div className="anim-fade-up stagger-2">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Protein</span>
            <span className="text-xs tabular-nums text-zinc-500">Tap + to log</span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-bold tabular-nums" style={{ color: proteinColor }}>
              {Math.round(totalToday)}
            </span>
            <span className="text-base text-zinc-500">/ {target}g</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, pctOfTarget)}%`,
                background: proteinColor,
                transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1), background 400ms ease",
              }}
            />
          </div>
        </Card>
      </div>

      {/* Routine items: supplements + meds + injections + skincare grouped */}
      <div className="anim-fade-up stagger-3">
        <DailyStack categories={["supplement", "medication", "injection", "skincare"]} />
      </div>

      {/* Long-term goals */}
      <div className="anim-fade-up stagger-4">
        <LongTermGoalsCard />
      </div>

      {/* Recent personal journal entries (read-only — log via +LOG) */}
      {entries.length > 0 && (
        <div className="anim-fade-up stagger-5">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Recent thoughts</span>
              <span className="text-[10px] text-zinc-600">Tap + → 🧠 to add</span>
            </div>
            <div className="space-y-3">
              {entries.slice(0, 5).map((e) => (
                <div key={e.id} className="pb-3 last:pb-0 border-b border-zinc-800 last:border-b-0">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                    {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                  {e.ai_summary && (
                    <p className="text-xs font-semibold text-zinc-300 mb-1">{e.ai_summary}</p>
                  )}
                  <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line line-clamp-4">{e.content}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

