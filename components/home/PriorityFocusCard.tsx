"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import CompletionToggle from "@/components/ui/CompletionToggle";
import EmptyState from "@/components/ui/EmptyState";
import { Target } from "lucide-react";
import { TYPE } from "@/lib/design-tokens";

// Top-of-Home focus surface — replaces both the old PriorityFocusCard +
// GoalTicker (their roles overlapped; this card now carries both).
//
//   - When goals exist + some pending → top 3 incomplete with CompletionToggle
//   - When all done                   → "All goals done" empty-positive state
//   - When zero goals exist           → "No goals set" empty state + link

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
  const incomplete = goals.filter((g) => !g.is_complete);
  const top3       = incomplete.slice(0, 3);
  const allDone    = totalGoals > 0 && incomplete.length === 0;
  const remaining  = totalGoals - goals.filter((g) => g.is_complete).length - top3.length;

  if (totalGoals === 0) {
    return (
      <Card>
        <EmptyState
          icon={Target}
          title="No goals set for today"
          description={<>Add daily goals on the <Link href="/life" className="text-zinc-300 underline">Life</Link> tab to get one-tap focus here.</>}
        />
      </Card>
    );
  }

  if (allDone) {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <Target size={14} className="text-emerald-400" />
          <span className="text-sm text-zinc-200 font-medium">All goals done. Solid day.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className={TYPE.label}>Focus — top 3</span>
        <span className="text-[10px] text-zinc-600 tabular-nums">
          {goals.filter((g) => g.is_complete).length} / {totalGoals} done
        </span>
      </div>
      <div className="space-y-2.5">
        {top3.map((goal) => (
          <div key={goal.id} className="flex items-center gap-3">
            <CompletionToggle
              done={goal.is_complete}
              onToggle={() => onToggle(goal.id, !goal.is_complete)}
              mode="small"
              celebrate
            />
            <span className="text-sm text-zinc-200 leading-tight flex-1">{goal.title}</span>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <Link href="/life" className="block mt-3 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
          +{remaining} more in Life →
        </Link>
      )}
    </Card>
  );
}
