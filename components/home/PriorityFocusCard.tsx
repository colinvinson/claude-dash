"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";

type Goal = { id: string; title: string; is_complete: boolean };

export default function PriorityFocusCard({
  goals,
  totalGoals,
  onToggle,
}: {
  goals: Goal[];
  totalGoals: number;
  onToggle: (id: string, complete: boolean) => void;
}) {
  const top3 = goals.filter((g) => !g.is_complete).slice(0, 3);
  const remaining = totalGoals - goals.filter((g) => g.is_complete).length - top3.length;

  if (top3.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="text-sm text-zinc-300 font-medium">All goals complete today</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          Focus
        </span>
        <span className="text-[10px] text-zinc-600">top 3 of {totalGoals}</span>
      </div>

      <div className="space-y-2.5">
        {top3.map((goal) => (
          <button
            key={goal.id}
            onClick={() => onToggle(goal.id, !goal.is_complete)}
            className="w-full flex items-center gap-3 text-left group"
          >
            <div
              className="w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            />
            <span className="text-sm text-zinc-200 group-hover:text-white transition-colors leading-tight">
              {goal.title}
            </span>
          </button>
        ))}
      </div>

      {remaining > 0 && (
        <Link
          href="/life"
          className="block mt-3 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          +{remaining} more in Life →
        </Link>
      )}
    </Card>
  );
}
