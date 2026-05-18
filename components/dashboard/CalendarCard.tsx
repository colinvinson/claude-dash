"use client";

import { useMemo } from "react";
import { useStack } from "@/hooks/useStack";
import { useWorkout } from "@/hooks/useWorkout";
import MilesCard from "@/components/dashboard/MilesCard";

// 04 // CALENDAR — center column bottom card.
// 7-day strip across the top (today highlighted) + a list of today's
// time-blocked items underneath.
//
// MVP data source: Rowan doesn't have a full calendar yet, so blocks
// are synthesized from today's scheduled supplement_stack items (those
// with a scheduled_at) + today's workout sets. Phase 7 can add a real
// calendar pipeline (Google iCal etc.). Until then this is "what's
// actually on your plate today" rather than "your calendar."

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun ... 6=Sat
  // Miles' screenshot starts on MON. Shift so monday=0.
  const offset = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function CalendarCard() {
  const { items } = useStack();
  const { todaySets } = useWorkout();

  const week = useMemo(() => {
    const s = startOfWeek();
    return DAY_NAMES.map((name, i) => {
      const d = new Date(s);
      d.setDate(d.getDate() + i);
      return { name, num: d.getDate(), date: d, isToday: isSameDay(d, new Date()) };
    });
  }, []);

  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();

  const todayDow = new Date().getDay();
  const blocks = useMemo(() => {
    type Block = { time: string; endTime?: string; title: string; sub: string; tag: string };
    const out: Block[] = [];

    // Scheduled supplement items today (those with explicit scheduled_at)
    items.forEach((i) => {
      if (!i.scheduled_at) return;
      const onToday = !i.days_of_week || i.days_of_week.length === 0 || i.days_of_week.length === 7 || i.days_of_week.includes(todayDow);
      if (!onToday) return;
      // scheduled_at is HH:MM:SS — slice to HH:MM for display
      const startHHMM = i.scheduled_at.slice(0, 5);
      out.push({
        time:  startHHMM,
        endTime: i.duration_min ? addMin(startHHMM, i.duration_min) : undefined,
        title: i.name,
        sub:   i.dose ?? (i.timing ?? "anytime").toLowerCase(),
        tag:   (i.timing ?? "ROUTINE").toUpperCase(),
      });
    });

    // Workout block synthesized if any sets logged today
    if (todaySets.length > 0) {
      const earliest = [...todaySets].sort((a, b) => a.logged_at.localeCompare(b.logged_at))[0];
      const t = new Date(earliest.logged_at);
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      out.push({
        time:  `${hh}:${mm}`,
        title: "Workout session",
        sub:   `${todaySets.length} sets logged`,
        tag:   "GYM",
      });
    }

    // Sort by time
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out.slice(0, 6);
  }, [items, todayDow, todaySets]);

  return (
    <MilesCard
      number="04"
      label="CALENDAR"
      right={<span>{month}</span>}
    >
      {/* 7-day strip */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {week.map((d) => (
          <div
            key={d.name}
            className="text-center py-2 rounded-md"
            style={{
              background: d.isToday ? "rgba(255,255,255,0.05)" : "transparent",
              border:     d.isToday ? "1px solid rgba(255,255,255,0.10)" : "1px solid transparent",
            }}
          >
            <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 font-semibold">
              {d.name}
            </div>
            <div className={`text-lg font-bold tabular-nums mt-0.5 ${d.isToday ? "text-zinc-100" : "text-zinc-500"}`}>
              {String(d.num).padStart(2, "0")}
            </div>
          </div>
        ))}
      </div>

      {/* Today's blocks */}
      {blocks.length === 0 ? (
        <div className="text-[11px] text-zinc-600 italic py-3 text-center">
          Nothing scheduled today. Routine items + workouts appear here as they happen.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {blocks.map((b, i) => (
            <div key={i} className="grid grid-cols-[70px_1fr_auto] gap-3 items-start py-2.5">
              <div className="text-[11px] tabular-nums text-zinc-500 leading-snug">
                <div>{b.time}</div>
                {b.endTime && <div className="text-zinc-700">{b.endTime}</div>}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] text-zinc-200 font-medium leading-snug line-clamp-1">{b.title}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{b.sub}</div>
              </div>
              <div className="text-[8px] uppercase tracking-[0.18em] text-zinc-500 font-bold px-1.5 py-0.5 rounded"
                   style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {b.tag}
              </div>
            </div>
          ))}
        </div>
      )}
    </MilesCard>
  );
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addMin(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + min;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
