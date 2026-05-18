"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { NAV_TABS } from "@/lib/nav";
import { useHealth } from "@/hooks/useHealth";
import LogSheet from "@/components/layout/LogSheet";

// TopRail — Miles-OS-style header.
//
// Layout (desktop):
//   [ROWAN OS // V1.0]  [HOME] [SCHEDULE] [GYM] [LIFE] [BIZ] [MONEY]  [LIVE STATS] [DATE TIME] [+] [avatar]
//
// Layout (mobile):
//   [ROWAN OS]                                                                              [+] [avatar]
//   (tabs are in BottomNav on mobile)
//
// Sticky top, near-black bg, hairline bottom border. Live clock that
// ticks every second. The "ticker" section shows brief biometrics
// (sleep, readiness) — Rowan's equivalent of his BTC / NDX / XAU.

const APP_NAME    = "ROWAN OS";
const APP_VERSION = "V1.0";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TopRail() {
  const pathname = usePathname();
  const now      = useNow();
  const { health } = useHealth();
  const [logOpen, setLogOpen] = useState(false);

  const activeIndex = NAV_TABS.findIndex((t) =>
    pathname === t.href || (pathname?.startsWith(t.href + "/") ?? false),
  );

  const dateStr = now.toLocaleDateString("en-US", {
    month: "short", day: "2-digit", year: "numeric",
  }).toUpperCase();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const sleep     = health.sleep_score;
  const readiness = health.readiness_score;
  const hrv       = health.hrv;

  return (
    <>
      <div
        className="sticky top-0 z-50 px-4"
        style={{
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex items-center gap-4 h-12">
          {/* Brand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">
              {APP_NAME}
            </span>
            <span className="hidden lg:inline text-[11px] font-semibold tracking-[0.18em] text-zinc-600 uppercase">
              // {APP_VERSION}
            </span>
          </div>

          {/* Tabs — desktop only (mobile uses BottomNav) */}
          <nav className="hidden lg:flex items-center gap-1 ml-2">
            {NAV_TABS.map((tab, i) => {
              const active = i === activeIndex;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="px-3 h-7 inline-flex items-center rounded-md text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors"
                  style={{
                    background: active ? "rgba(255,255,255,0.05)" : "transparent",
                    border:     active ? "1px solid rgba(255,255,255,0.10)" : "1px solid transparent",
                    color:      active ? "#fafafa" : "#71717a",
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Ticker — biometrics in Miles' BTC / NDX / XAU slot */}
          <div className="hidden xl:flex items-center gap-4 flex-shrink-0">
            <Stat label="SLEEP"     value={sleep != null ? `${sleep}` : "—"} />
            <Stat label="READINESS" value={readiness != null ? `${readiness}` : "—"} />
            <Stat label="HRV"       value={hrv != null ? `${hrv}` : "—"} />
          </div>

          {/* Date + time */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <span className="text-[11px] font-medium tracking-[0.12em] text-zinc-500 uppercase">
              {dateStr}
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-zinc-200">
              {timeStr}
            </span>
          </div>

          {/* Log + avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setLogOpen(true)}
              aria-label="Log something"
              className="w-7 h-7 flex items-center justify-center rounded-md bg-white text-zinc-900 hover:opacity-90 transition-opacity"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
            <div className="w-7 h-7 flex items-center justify-center rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
              CV
            </div>
          </div>
        </div>
      </div>

      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[9px] font-semibold tracking-[0.18em] text-zinc-600 uppercase">
        {label}
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-zinc-300">
        {value}
      </span>
    </div>
  );
}
