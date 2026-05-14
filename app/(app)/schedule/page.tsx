"use client";

import { useGoals } from "@/hooks/useGoals";
import { useStack } from "@/hooks/useStack";
import { useProtein } from "@/hooks/useProtein";
import { useJournal } from "@/hooks/useJournal";
import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";
import HealthCard from "@/components/health/HealthCard";
import LongTermGoalsCard from "@/components/life/LongTermGoalsCard";
import TimelineSchedule from "@/components/schedule/TimelineSchedule";

function GoalRow({ id, title, isComplete, onToggle }: {
  id: string;
  title: string;
  isComplete: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      key={id}
      onClick={onToggle}
      className="flex items-center gap-3 w-full text-left py-2.5 border-b border-[#1f1f1f]/60 last:border-0 group"
    >
      <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
        isComplete ? "bg-green-500 border-green-500" : "border-zinc-600 group-hover:border-zinc-400"
      }`}>
        {isComplete && (
          <svg viewBox="0 0 10 8" className="w-3 h-2.5" fill="none" stroke="white" strokeWidth="2">
            <path d="M1 4l2.5 2.5L9 1" />
          </svg>
        )}
      </div>
      <span className={`flex-1 text-sm ${isComplete ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
        {title}
      </span>
    </button>
  );
}

export default function SchedulePage() {
  const { items, toggle } = useStack();
  const { goals, toggleGoal } = useGoals();
  const { totalToday, target, pctOfTarget } = useProtein();
  const { entries } = useJournal({ entryCategory: "personal" });

  const sortedGoals = [...goals].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const goalsDone = goals.filter((g) => g.is_complete).length;

  const proteinColor =
    pctOfTarget >= 80 ? "#34d399" :
    pctOfTarget >= 50 ? "#fbbf24" :
                        "#a1a1aa";

  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <SectionLabel>Schedule</SectionLabel>
      </div>

      {/* Oura biometrics — ambient context for the day */}
      <div className="anim-fade-up stagger-1">
        <HealthCard />
      </div>

      {/* Protein progress — continuous tracker, lives above the timed schedule */}
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

      {/* Timeline — the main attraction */}
      <div className="anim-fade-up stagger-3">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Today</span>
            <span className="text-[11px] text-zinc-600">{items.filter((i) => i.taken).length}/{items.length} done · resets 6 AM</span>
          </div>
          <TimelineSchedule items={items} onToggle={toggle} />
        </Card>
      </div>

      {/* Today's non-recurring goals — untimed, sit below the timeline */}
      <div className="anim-fade-up stagger-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Goals</span>
            {goals.length > 0 && (
              <span className="text-[11px] text-zinc-500">{goalsDone}/{goals.length}</span>
            )}
          </div>
          {goals.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2">No goals set for today. Add on Home.</p>
          ) : (
            sortedGoals.map((g) => (
              <GoalRow
                key={g.id}
                id={g.id}
                title={g.title}
                isComplete={g.is_complete}
                onToggle={() => toggleGoal(g.id, !g.is_complete)}
              />
            ))
          )}
        </Card>
      </div>

      {/* Ambient: long-term goals + recent personal thoughts */}
      <div className="anim-fade-up stagger-5">
        <LongTermGoalsCard />
      </div>

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
