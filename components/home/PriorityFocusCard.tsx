"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import Card from "@/components/ui/Card";
import { haptic } from "@/lib/haptic";

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
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  function handleComplete(id: string, current: boolean) {
    if (current) {
      // Uncompleting — fire immediately, no animation
      onToggle(id, false);
      return;
    }
    haptic("medium");
    setCompleting((prev) => new Set(prev).add(id));
    // Let the checkmark pop + green flash animate, then commit
    setTimeout(() => {
      onToggle(id, true);
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400);
  }

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
        {top3.map((goal) => {
          const isCompleting = completing.has(goal.id);
          return (
            <button
              key={goal.id}
              onClick={() => handleComplete(goal.id, goal.is_complete)}
              className="w-full flex items-center gap-3 text-left group rounded-lg px-1 py-1 -mx-1"
              style={{
                background: isCompleting ? "rgba(52,211,153,0.15)" : "transparent",
                transition: "background 380ms ease-out",
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: isCompleting ? "#34d399" : "transparent",
                  border: `2px solid ${isCompleting ? "#34d399" : "rgba(255,255,255,0.22)"}`,
                  transition: "background 200ms ease, border-color 200ms ease",
                }}
              >
                {isCompleting && <Check size={11} strokeWidth={3.5} className="text-zinc-900 anim-pop" />}
              </div>
              <span
                className="text-sm text-zinc-200 group-hover:text-white leading-tight"
                style={{
                  textDecoration: isCompleting ? "line-through" : "none",
                  opacity: isCompleting ? 0.6 : 1,
                  transition: "opacity 200ms ease, text-decoration-color 200ms ease",
                }}
              >
                {goal.title}
              </span>
            </button>
          );
        })}
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
