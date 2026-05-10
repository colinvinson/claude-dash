"use client";

import { useEffect, useState } from "react";

const WAKE_HOUR  = 8;
const SLEEP_HOUR = 24;
const C          = 2 * Math.PI * 52;          // circumference

// 9-stop sun-cycle palette (0% → 100%)
const PALETTE: [number, number, number][] = [
  [255, 216, 158],  // 0%    morning gold
  [255, 205, 121],  // 12.5%
  [255, 227, 143],  // 25%   bright midday
  [255, 183, 106],  // 37.5%
  [255, 149,  89],  // 50%   amber
  [243, 111,  79],  // 62.5%
  [226,  93, 122],  // 75%   sunset pink
  [123,  91, 176],  // 87.5% twilight
  [ 47,  58, 102],  // 100%  deep night
];

function lerpColor(pct: number): string {
  const t   = Math.max(0, Math.min(1, pct / 100)) * (PALETTE.length - 1);
  const lo  = Math.floor(t);
  const hi  = Math.min(PALETTE.length - 1, lo + 1);
  const f   = t - lo;
  const r   = Math.round(PALETTE[lo][0] + f * (PALETTE[hi][0] - PALETTE[lo][0]));
  const g   = Math.round(PALETTE[lo][1] + f * (PALETTE[hi][1] - PALETTE[lo][1]));
  const b   = Math.round(PALETTE[lo][2] + f * (PALETTE[hi][2] - PALETTE[lo][2]));
  return `rgb(${r},${g},${b})`;
}

function fmtClock(d: Date): string {
  const h  = d.getHours() % 12 || 12;
  const m  = String(d.getMinutes()).padStart(2, "0");
  const ap = d.getHours() < 12 ? "AM" : "PM";
  return `${h}:${m} ${ap}`;
}

function fmtRemain(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type Ring = {
  pct: number;
  color: string;
  offset: number;
  phase: string;
  status: string;
  remain: string;
  clock: string;
};

function compute(): Ring {
  const now   = new Date();
  const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const clock = fmtClock(now);

  if (hours < WAKE_HOUR) {
    const toWake = WAKE_HOUR - hours;
    return { pct: 0, color: "#4D4B47", offset: C, phase: "SLEEPING",
      status: `😴 Still sleeping`, remain: `${fmtRemain(toWake)} until wake-up`, clock };
  }

  if (hours >= SLEEP_HOUR) {
    return { pct: 100, color: "#E25D7A", offset: 0, phase: "PAST BEDTIME",
      status: "⚠️ Past bedtime", remain: "Sleep!", clock };
  }

  const pct    = Math.min(100, (hours - WAKE_HOUR) / (SLEEP_HOUR - WAKE_HOUR) * 100);
  const remain = SLEEP_HOUR - hours;
  const color  = lerpColor(pct);
  const offset = Math.round(C * (1 - pct / 100) * 1000) / 1000;

  let phase: string, status: string;
  if      (pct < 25) { phase = "MORNING";   status = "☀️ Morning — fresh start"; }
  else if (pct < 50) { phase = "MIDDAY";    status = "⚡ Midday — keep moving";  }
  else if (pct < 75) { phase = "AFTERNOON"; status = "🔥 Afternoon — push it";   }
  else if (pct < 90) { phase = "EVENING";   status = "⏳ Evening — wrap up";     }
  else               { phase = "BEDTIME";   status = "🌙 Bedtime soon";          }

  return { pct: Math.round(pct), color, offset, phase, status,
    remain: `${fmtRemain(remain)} awake time left`, clock };
}

export default function DayRing() {
  const [ring, setRing] = useState<Ring | null>(null);

  useEffect(() => {
    setRing(compute());
    const id = setInterval(() => setRing(compute()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!ring) {
    return (
      <div className="flex items-center gap-5 flex-wrap justify-center">
        <div style={{ width: 168, height: 168 }} />
        <div className="flex flex-col gap-1.5" style={{ maxWidth: 240 }} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5 flex-wrap justify-center">
      {/* SVG ring */}
      <div className="relative" style={{ width: 168, height: 168 }}>
        <svg viewBox="0 0 120 120" width={168} height={168}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* track */}
          <circle cx={60} cy={60} r={52}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
          {/* fill */}
          <circle cx={60} cy={60} r={52}
            fill="none"
            stroke={ring.color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={ring.offset}
            transform="rotate(-90 60 60)"
            filter="url(#glow)"
            suppressHydrationWarning
            style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1), stroke 0.7s cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        {/* center overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[40px] font-extrabold text-white tabular-nums leading-none" style={{ letterSpacing: "-0.04em" }}>
            {ring.pct === 0 && ring.phase === "SLEEPING" ? "—" : `${ring.pct}%`}
          </span>
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 mt-1">
            {ring.phase}
          </span>
          <span className="text-[10.5px] text-zinc-500 mt-0.5 tabular-nums">{ring.clock}</span>
        </div>
      </div>

      {/* text column */}
      <div className="flex flex-col gap-1.5" style={{ maxWidth: 240 }}>
        <p className="text-sm font-bold text-zinc-100">{ring.status}</p>
        <p className="text-xs text-zinc-400 tabular-nums">{ring.remain}</p>
        <p className="text-[11px] text-zinc-600 tabular-nums">8:00 AM – 12:00 AM</p>
      </div>
    </div>
  );
}
