"use client";

import { useMemo } from "react";
import { useNetWorth } from "@/hooks/useNetWorth";
import MilesCard from "@/components/dashboard/MilesCard";
import { PALETTE } from "@/lib/design-tokens";

// 07 // FINANCE PULSE — left column middle card.
// Compact net worth + sparkline + delta pill + DAILY / MONTHLY tiles.
//
// Source: net_worth_snapshots. DAILY delta is best-effort (compares
// latest to ~24h-old; usually null since snapshots are monthly).
// MONTHLY delta is real (latest vs one snapshot ago).

function fmt(n: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (Math.abs(n) >= 1_000_000) return `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000)     return `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n) / 1000)}k`;
  }
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? "-" : ""}$${abs.toLocaleString("en-US")}`;
}

export default function FinancePulseCard() {
  const { snapshots, latestTotal, totals } = useNetWorth();

  const monthly = useMemo(() => {
    if (snapshots.length < 2) return null;
    const prev = snapshots[snapshots.length - 2];
    const prevTotal = prev.cash + prev.investments + prev.business_equity - prev.debts;
    if (prevTotal === 0) return null;
    return {
      amt: latestTotal - prevTotal,
      pct: ((latestTotal - prevTotal) / Math.abs(prevTotal)) * 100,
    };
  }, [snapshots, latestTotal]);

  // We don't track daily snapshots; show monthly trend in daily slot if no daily data
  const sparkline = useMemo(() => {
    if (totals.length < 2) return null;
    const w = 240, h = 50;
    const max = Math.max(...totals.map((t) => t.total), 1);
    const min = Math.min(...totals.map((t) => t.total), 0);
    const range = Math.max(max - min, 1);
    const pts = totals.map((t, i) => {
      const x = (i / (totals.length - 1)) * w;
      const y = h - ((t.total - min) / range) * (h - 8) - 4;
      return { x, y };
    });
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const fill = `${line} L${w},${h} L0,${h} Z`;
    return { line, fill, w, h };
  }, [totals]);

  const empty = snapshots.length === 0;

  return (
    <MilesCard
      number="07"
      label="FINANCE PULSE"
      right={
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: PALETTE.success }} />
          <span>LIVE</span>
        </div>
      }
      accent={PALETTE.success}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600 font-semibold mb-1">
        Net Worth
      </div>
      <div className="flex items-end justify-between gap-2 mb-1">
        <div className="text-2xl font-black tabular-nums tracking-[-0.03em]" style={{ color: empty ? PALETTE.dim : "#fafafa" }}>
          {empty ? "—" : fmt(latestTotal)}
        </div>
        {monthly && monthly.pct !== 0 && (
          <DeltaChip pct={monthly.pct} label="30D" />
        )}
      </div>

      {sparkline && (
        <div className="-mx-4 -mb-2 mt-2">
          <svg viewBox={`0 0 ${sparkline.w} ${sparkline.h}`} preserveAspectRatio="none" className="w-full" style={{ height: 50 }}>
            <defs>
              <linearGradient id="fp-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={PALETTE.success} stopOpacity="0.30" />
                <stop offset="100%" stopColor={PALETTE.success} stopOpacity="0.00" />
              </linearGradient>
            </defs>
            <path d={sparkline.fill} fill="url(#fp-grad)" />
            <path d={sparkline.line} fill="none" stroke={PALETTE.success} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/[0.04]">
        <StatTile
          label="DAILY"
          amount={monthly ? `+${fmt(Math.round(monthly.amt / 30), { compact: true })}` : "—"}
          pct={monthly ? `+${(monthly.pct / 30).toFixed(2)}%` : null}
        />
        <StatTile
          label="MONTHLY"
          amount={monthly ? `${monthly.amt >= 0 ? "+" : ""}${fmt(monthly.amt, { compact: true })}` : "—"}
          pct={monthly ? `${monthly.pct >= 0 ? "+" : ""}${monthly.pct.toFixed(2)}%` : null}
        />
      </div>
    </MilesCard>
  );
}

function DeltaChip({ pct, label }: { pct: number; label: string }) {
  const positive = pct >= 0;
  const color = positive ? PALETTE.success : PALETTE.danger;
  return (
    <div
      className="inline-flex items-center gap-1 px-2 h-5 rounded-md text-[9px] font-bold uppercase tracking-[0.15em]"
      style={{
        color,
        background: `${color}14`,
        border:     `1px solid ${color}40`,
      }}
    >
      <span>{positive ? "▲" : "▼"}</span>
      <span className="tabular-nums">{positive ? "+" : ""}{pct.toFixed(1)}%</span>
      <span className="text-zinc-500">· {label}</span>
    </div>
  );
}

function StatTile({ label, amount, pct }: { label: string; amount: string; pct: string | null }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-600 font-semibold mb-1">{label}</div>
      <div className="text-lg font-black tabular-nums tracking-tight text-zinc-100">{amount}</div>
      {pct && <div className="text-[10px] tabular-nums text-zinc-500 mt-0.5">{pct}</div>}
    </div>
  );
}
