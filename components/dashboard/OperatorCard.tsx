"use client";

import { useSettings } from "@/hooks/useSettings";
import { useGoals } from "@/hooks/useGoals";
import { useDailyContext } from "@/hooks/useDailyContext";
import MilesCard from "@/components/dashboard/MilesCard";

// 01 // OPERATOR — left-column top card.
// Avatar square + name + role/city + FOCUS (today's one thing) + STREAK.
// ONLINE green-dot pulse in the right slot of the section header.

export default function OperatorCard() {
  const { profile }      = useSettings();
  const { streak }       = useGoals();
  const { context }      = useDailyContext();

  const name = (profile.full_name ?? "Colin Vinson").trim();
  const [first, ...rest] = name.split(/\s+/);
  const last = rest.join(" ");
  const initials = `${first?.[0] ?? "C"}${rest[0]?.[0] ?? "V"}`.toUpperCase();

  const focus = (context?.raw_text ?? "").trim() || "—";

  return (
    <MilesCard
      number="01"
      label="OPERATOR"
      right={
        <div className="flex items-center gap-1.5">
          <span className="relative inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
          </span>
          <span>ONLINE</span>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            background: "rgba(255,255,255,0.05)",
            border:     "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span className="text-[11px] font-bold text-zinc-400 tracking-widest">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-zinc-100 font-semibold text-sm leading-tight">
            {first} <span className="italic font-normal text-zinc-400">{last}</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 mt-0.5">
            Operator · 19
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-white/[0.04]">
        <div>
          <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-600 font-semibold">FOCUS</div>
          <div className="text-[12px] text-zinc-300 mt-1 italic line-clamp-2">
            {focus}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-600 font-semibold">STREAK</div>
          <div className="text-zinc-100 mt-0.5">
            <span className="text-lg font-black tabular-nums">{streak}</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 font-semibold ml-1">DAYS</span>
          </div>
        </div>
      </div>
    </MilesCard>
  );
}
