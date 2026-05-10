"use client";

import { useEffect, useRef, useState } from "react";
import { useGoals } from "@/hooks/useGoals";

type TickerItem = { status: "done" | "pending" | "empty"; text: string };

function buildItems(goals: { is_complete: boolean; title: string }[]): TickerItem[] {
  if (goals.length === 0)
    return [{ status: "empty", text: "No goals set for today — add one to get rolling." }];
  if (goals.every((g) => g.is_complete))
    return [{ status: "done", text: "All goals done — solid day." }];
  return goals.filter((g) => !g.is_complete).map((g) => ({ status: "pending", text: g.title }));
}

export default function GoalTicker() {
  const { goals, loading } = useGoals();

  const [current, setCurrent] = useState<TickerItem>({ status: "empty", text: "Loading…" });
  const [entering, setEntering] = useState(false);
  const idxRef   = useRef(0);
  const itemsRef = useRef<TickerItem[]>([]);

  function tick(items: TickerItem[]) {
    const idx = idxRef.current % items.length;
    idxRef.current = (idx + 1) % items.length;
    setEntering(true);
    setCurrent(items[idx]);
    setTimeout(() => setEntering(false), 450);
  }

  useEffect(() => {
    if (loading) return;
    const items = buildItems(goals);
    itemsRef.current = items;
    idxRef.current   = 0;
    tick(items);
    const id = setInterval(() => tick(itemsRef.current), 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, loading]);

  const done  = goals.filter((g) => g.is_complete).length;
  const total = goals.length;

  const statusGlyph = current.status === "done" ? "✓" : current.status === "pending" ? "○" : "·";
  const statusColor = current.status === "done" ? "#6BE3A4" : "#76746E";

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl mb-4"
      style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.30) 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>

      {/* pulsing LED */}
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
        background: "#6BE3A4",
        boxShadow: "0 0 8px rgba(107,227,164,0.7)",
        animation: "ledPulse 1.6s ease-in-out infinite",
      }} />

      {/* label */}
      <span className="text-[9.5px] font-black uppercase tracking-[0.18em] text-zinc-500 flex-shrink-0 tabular-nums">
        GOALS
      </span>

      {/* sliding text */}
      <div className="flex-1 overflow-hidden h-[22px] flex items-center">
        <div key={current.text} className={`flex items-center gap-2 text-[12.5px] font-semibold text-white tabular-nums whitespace-nowrap ${entering ? "animate-ticker-enter" : ""}`}>
          <span style={{ color: statusColor, width: 14, display: "inline-block", textAlign: "center", flexShrink: 0 }}>
            {statusGlyph}
          </span>
          <span className="overflow-hidden text-ellipsis">{current.text}</span>
        </div>
      </div>

      {/* meta pill */}
      <span className="text-[11px] font-bold tabular-nums text-zinc-400 px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.04)", letterSpacing: "0.04em" }}>
        {done}/{total}
      </span>

      <style>{`
        @keyframes ledPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.45;transform:scale(0.85)} }
        @keyframes tickerEnter { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
        .animate-ticker-enter { animation: tickerEnter 0.45s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>
    </div>
  );
}
