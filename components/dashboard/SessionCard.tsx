"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useDailyContext } from "@/hooks/useDailyContext";
import MilesCard from "@/components/dashboard/MilesCard";

// 02 // SESSION — center column top card.
// Italic "Good afternoon, [name]." greeting + day label + live clock,
// then a "TODAY I WILL [Set today's one thing…]" capture row with a
// Capture button. Writes the captured text to daily_context (which
// already powers DayBrief / Operator focus).

function greeting(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function SessionCard() {
  const now = useNow();
  const { profile } = useSettings();
  const { context, submit } = useDailyContext();

  const firstName = (profile.full_name ?? "Colin").trim().split(/\s+/)[0] || "Colin";

  const dayStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const hh   = String(now.getHours()).padStart(2, "0");
  const mm   = String(now.getMinutes()).padStart(2, "0");
  const ss   = String(now.getSeconds()).padStart(2, "0");

  const [draft, setDraft] = useState("");
  const [busy, setBusy]   = useState(false);
  const placeholder = context?.raw_text ? "Update today's one thing…" : "Set today's one thing…";

  async function capture() {
    const t = draft.trim();
    if (!t || busy) return;
    setBusy(true);
    await submit(t);
    setDraft("");
    setBusy(false);
  }

  // Get timezone abbreviation
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop() ?? "LOCAL";

  return (
    <MilesCard
      number="02"
      label="SESSION"
      right={<span className="text-zinc-500">{tz} · UTC{(-(now.getTimezoneOffset() / 60)).toString().padStart(2, "+")}</span>}
      paddingClass="p-5 pt-3"
    >
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl lg:text-4xl font-semibold italic text-zinc-100 leading-tight tracking-tight">
            {greeting(now.getHours())}, <span className="not-italic font-bold">{firstName}</span>.
          </h1>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600 font-semibold mt-2">
            {dayStr}
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl lg:text-5xl font-black tabular-nums tracking-[-0.04em] text-zinc-100 leading-none">
            {hh}:{mm}
            <span className="text-zinc-600 text-xl align-baseline ml-0.5 font-semibold">{ss}</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600 font-semibold mt-2">
            Local Time
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 pb-3">
        <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-600 font-semibold whitespace-nowrap">
          Today I will
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") capture(); }}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-0 outline-none text-sm italic text-zinc-300 placeholder:text-zinc-600"
        />
      </div>
      <div
        className="flex items-center gap-2 rounded-md px-3 py-2.5 mt-1"
        style={{
          background: "rgba(255,255,255,0.03)",
          border:     "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span className="text-zinc-600 text-sm">✦</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") capture(); }}
          placeholder="Capture"
          className="flex-1 bg-transparent border-0 outline-none text-[13px] text-zinc-200 placeholder:text-zinc-600"
        />
        <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 font-semibold whitespace-nowrap">⏎</span>
        <button
          onClick={capture}
          disabled={busy || draft.trim().length === 0}
          className="px-3 h-7 rounded-md text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 disabled:opacity-40 transition-opacity ml-1"
          style={{
            background: "rgba(255,255,255,0.06)",
            border:     "1px solid rgba(255,255,255,0.10)",
            color:      "#fafafa",
          }}
        >
          <Send size={10} />
          Capture
        </button>
      </div>
    </MilesCard>
  );
}
