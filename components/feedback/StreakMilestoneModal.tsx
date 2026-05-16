"use client";

import { useEffect, useState } from "react";
import {
  MILESTONES, detectMilestoneCrossing, lastStreakSeen, markStreakSeen, milestoneCopy,
  type Milestone,
} from "@/lib/feedback/milestones";
import { haptic } from "@/lib/feedback/haptics";
import ConfettiBurst from "@/components/ui/ConfettiBurst";
import { Flame, X } from "lucide-react";

// Renders nothing unless a streak milestone was just crossed. Watches the
// `streak` prop; on first render where prev<threshold && current>=threshold,
// opens a full-screen celebration with confetti + a tailored line.
//
// Persists "highest streak seen" in localStorage so a refresh doesn't
// retrigger.

export default function StreakMilestoneModal({ streak }: { streak: number }) {
  const [active, setActive] = useState<Milestone | null>(null);
  const [burst,  setBurst]  = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (streak <= 0) return;
    const prev = lastStreakSeen();
    const crossed = detectMilestoneCrossing(streak, prev);
    if (crossed) {
      setActive(crossed);
      setBurst((n) => n + 1);
      haptic("milestone");
    }
    // Always advance the "seen" marker — even non-milestone days — so we don't
    // retrigger an old milestone if the streak dips and recovers later.
    markStreakSeen(Math.max(prev, streak));
  }, [streak]);

  // Cycle through additional bursts every 350ms for ~2s to feel "festive".
  useEffect(() => {
    if (!active) return;
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      setBurst((n) => n + 1);
      if (count >= 4) clearInterval(id);
    }, 380);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;
  const { title, line } = milestoneCopy(active);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm anim-fade">
      <div className="relative w-[88%] max-w-sm anim-scale">
        <div
          className="relative rounded-3xl p-6 text-center"
          style={{
            background: "linear-gradient(180deg, rgba(251,191,36,0.18) 0%, rgba(20,20,22,0.95) 50%)",
            border: "1px solid rgba(251,191,36,0.35)",
            boxShadow: "0 25px 80px rgba(251,191,36,0.25)",
          }}
        >
          <ConfettiBurst trigger={burst} count={40} spread={200} />
          <div className="flex justify-center mb-3">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(251,191,36,0.18)", border: "2px solid rgba(251,191,36,0.45)" }}>
              <Flame size={36} className="text-amber-300" />
            </div>
          </div>
          <div className="text-6xl font-black text-white tabular-nums mb-1">{streak}</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300 font-bold mb-4">{title}</div>
          <p className="text-sm text-zinc-200 leading-relaxed mb-6">{line}</p>
          <button
            onClick={() => setActive(null)}
            className="w-full py-3 rounded-xl bg-amber-300 text-zinc-900 text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Keep going
          </button>
          <button
            onClick={() => setActive(null)}
            className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-200"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
          {/* Next milestone tease */}
          {(() => {
            const next = MILESTONES.find((m) => m > active);
            if (!next) return null;
            return (
              <p className="text-[10px] text-zinc-500 mt-3">Next milestone: {next} days · {next - streak} to go</p>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
