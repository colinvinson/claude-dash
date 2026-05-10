"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import { useMeditation } from "@/hooks/useMeditation";

const DURATIONS = [5, 10, 15, 20, 30];

export default function MeditationCard() {
  const { todayMinutes, streak, last7, logSession, loading } = useMeditation();
  const [logging, setLogging] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  async function handleLog(min: number) {
    setLogging(true);
    await logSession(min);
    setDone(min);
    setLogging(false);
    setTimeout(() => setDone(null), 2000);
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          Meditation
        </span>
        {streak > 0 && (
          <span
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}
          >
            {streak}d streak
          </span>
        )}
      </div>

      {/* Today total */}
      <div className="flex items-baseline gap-1.5 mb-4">
        <span className="text-3xl font-bold tabular-nums text-white">
          {todayMinutes}
        </span>
        <span className="text-sm text-zinc-500">min today</span>
      </div>

      {/* 7-day bar chart */}
      <div className="flex items-end gap-1 h-8 mb-4">
        {last7.map(({ date, minutes }) => {
          const max = Math.max(...last7.map((d) => d.minutes), 1);
          const height = minutes > 0 ? Math.max((minutes / max) * 100, 12) : 4;
          const isToday = date === last7[last7.length - 1].date;
          return (
            <div key={date} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${height}%`,
                  background: minutes > 0
                    ? isToday
                      ? "rgba(139,92,246,0.85)"
                      : "rgba(139,92,246,0.35)"
                    : "rgba(255,255,255,0.06)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div className="flex gap-1 mb-4">
        {last7.map(({ date }) => {
          const d = new Date(date + "T12:00:00");
          return (
            <div key={date} className="flex-1 text-center text-[8px] text-zinc-600 uppercase tracking-wide">
              {d.toLocaleDateString("en-US", { weekday: "narrow" })}
            </div>
          );
        })}
      </div>

      {/* Duration buttons */}
      <div className="flex gap-2">
        {DURATIONS.map((min) => (
          <button
            key={min}
            disabled={logging}
            onClick={() => handleLog(min)}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
            style={{
              background: done === min
                ? "rgba(139,92,246,0.6)"
                : "rgba(255,255,255,0.06)",
              color: done === min ? "#fff" : "#a1a1aa",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {done === min ? "✓" : `${min}m`}
          </button>
        ))}
      </div>
    </Card>
  );
}
