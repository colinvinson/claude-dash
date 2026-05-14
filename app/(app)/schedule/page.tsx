"use client";

import { useGoals } from "@/hooks/useGoals";
import { useStack, type StackItem } from "@/hooks/useStack";
import { useProtein } from "@/hooks/useProtein";
import { useJournal } from "@/hooks/useJournal";
import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";
import HealthCard from "@/components/health/HealthCard";
import LongTermGoalsCard from "@/components/life/LongTermGoalsCard";
import { Pill, Syringe, Sparkles as Skincare, Beaker, Sun, Moon, Sunset } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  supplement: Pill,
  medication: Beaker,
  injection:  Syringe,
  skincare:   Skincare,
};

// Map raw timing strings → which time-of-day bucket they go in.
// Items with unknown / empty timing default to morning.
function bucketFor(timing: string): "morning" | "midday" | "night" {
  const t = (timing ?? "").trim().toLowerCase();
  if (t.includes("evening") || t.includes("night") || t.includes("pre-bed") || t.includes("bed")) return "night";
  if (t.includes("lunch") || t.includes("afternoon") || t.includes("midday")) return "midday";
  return "morning";
}

function ItemRow({ item, onToggle }: { item: StackItem; onToggle: () => void }) {
  const Icon = CATEGORY_ICON[item.category] ?? Pill;
  return (
    <button
      onClick={onToggle}
      className="flex items-start gap-3 w-full text-left py-2.5 border-b border-[#1f1f1f]/60 last:border-0 group"
    >
      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
        item.taken ? "bg-green-500 border-green-500" : "border-zinc-600 group-hover:border-zinc-400"
      }`}>
        {item.taken && (
          <svg viewBox="0 0 10 8" className="w-3 h-2.5" fill="none" stroke="white" strokeWidth="2">
            <path d="M1 4l2.5 2.5L9 1" />
          </svg>
        )}
      </div>
      <Icon size={13} className="mt-1 flex-shrink-0 text-zinc-600" />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${item.taken ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
          {item.name}
        </span>
        {item.notes && (
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{item.notes}</p>
        )}
      </div>
      <span className="text-[11px] text-zinc-600 whitespace-nowrap mt-0.5">{item.dose}</span>
    </button>
  );
}

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

function BlockHeader({ Icon, label, count }: { Icon: LucideIcon; label: string; count?: string }) {
  return (
    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#1f1f1f]">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">{label}</span>
      </div>
      {count && <span className="text-[11px] text-zinc-500">{count}</span>}
    </div>
  );
}

export default function SchedulePage() {
  const { items, toggle } = useStack();
  const { goals, toggleGoal } = useGoals();
  const { totalToday, target, pctOfTarget } = useProtein();
  const { entries } = useJournal({ entryCategory: "personal" });

  const morning = items.filter((i) => bucketFor(i.timing) === "morning");
  const midday  = items.filter((i) => bucketFor(i.timing) === "midday");
  const night   = items.filter((i) => bucketFor(i.timing) === "night");

  const sortedGoals = [...goals].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const morningDone = morning.filter((i) => i.taken).length;
  const middayDone  = midday.filter((i) => i.taken).length;
  const nightDone   = night.filter((i) => i.taken).length;
  const goalsDone   = goals.filter((g) => g.is_complete).length;

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

      {/* Protein progress strip — continuous, lives above the timed schedule */}
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

      {/* MORNING */}
      <div className="anim-fade-up stagger-3">
        <Card>
          <BlockHeader Icon={Sun} label="Morning" count={morning.length > 0 ? `${morningDone}/${morning.length}` : undefined} />
          {morning.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2">No morning routine items yet. Add in Settings.</p>
          ) : (
            morning.map((i) => (
              <ItemRow key={i.id} item={i} onToggle={() => toggle(i.id, i.taken, i.log_id)} />
            ))
          )}
        </Card>
      </div>

      {/* MIDDAY (only if any items) */}
      {midday.length > 0 && (
        <div className="anim-fade-up stagger-4">
          <Card>
            <BlockHeader Icon={Sunset} label="Midday" count={`${middayDone}/${midday.length}`} />
            {midday.map((i) => (
              <ItemRow key={i.id} item={i} onToggle={() => toggle(i.id, i.taken, i.log_id)} />
            ))}
          </Card>
        </div>
      )}

      {/* TODAY'S GOALS — non-recurring todos slot between morning + night */}
      <div className="anim-fade-up stagger-4">
        <Card>
          <BlockHeader Icon={Skincare} label="Today" count={goals.length > 0 ? `${goalsDone}/${goals.length}` : undefined} />
          {goals.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2">No goals set for today. Add on Home.</p>
          ) : (
            sortedGoals.map((g) => (
              <GoalRow key={g.id} id={g.id} title={g.title} isComplete={g.is_complete} onToggle={() => toggleGoal(g.id, !g.is_complete)} />
            ))
          )}
        </Card>
      </div>

      {/* NIGHT */}
      <div className="anim-fade-up stagger-5">
        <Card>
          <BlockHeader Icon={Moon} label="Night" count={night.length > 0 ? `${nightDone}/${night.length}` : undefined} />
          {night.length === 0 ? (
            <p className="text-xs text-zinc-500 py-2">No night routine items yet. Add in Settings.</p>
          ) : (
            night.map((i) => (
              <ItemRow key={i.id} item={i} onToggle={() => toggle(i.id, i.taken, i.log_id)} />
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
