"use client";

import { useMemo } from "react";
import { useNetWorth } from "@/hooks/useNetWorth";
import SectionHeader from "@/components/ui/SectionHeader";
import { PALETTE, TYPE } from "@/lib/design-tokens";

// Net worth hero — full-width opening surface on the Finances tab.
// Hierarchy mirrors Miles' a0 card: tiny section label → giant currency
// figure → 30D / 1Y delta chips on the right → wide sparkline anchored
// to the baseline. Numbers are tabular so digits don't shift width.
//
// Reads everything from useNetWorth — no per-page state. Empty state
// when no snapshots: show "—" + a hint to log one (handled by parent
// rendering the edit form below).

function fmt(n: number, opts?: { compact?: boolean }): string {
  const compact = opts?.compact ?? false;
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000)     return `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1000).toFixed(1)}k`;
    return `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n))}`;
  }
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? "-" : ""}$${abs.toLocaleString("en-US")}`;
}

export default function NetWorthHero() {
  const { snapshots, latestTotal, totals, deltaPct } = useNetWorth();

  // Compute 30-day delta (vs the snapshot ~30 days ago)
  const delta30 = useMemo(() => {
    if (snapshots.length < 2) return null;
    const now = new Date();
    const target = new Date(now); target.setDate(target.getDate() - 30);
    const cutoff = target.toISOString().slice(0, 10);
    const prior = [...snapshots].reverse().find((s) => s.snapshot_date <= cutoff);
    if (!prior) return null;
    const priorTotal = prior.cash + prior.investments + prior.business_equity - prior.debts;
    if (priorTotal === 0) return null;
    return Math.round(((latestTotal - priorTotal) / Math.abs(priorTotal)) * 100);
  }, [snapshots, latestTotal]);

  // Sparkline path. Spans full width; emerald stroke.
  const sparkline = useMemo(() => {
    if (totals.length < 2) return null;
    const width  = 800;
    const height = 80;
    const max = Math.max(...totals.map((t) => t.total), 1);
    const min = Math.min(...totals.map((t) => t.total), 0);
    const range = Math.max(max - min, 1);
    const points = totals.map((t, i) => {
      const x = (i / (totals.length - 1)) * width;
      const y = height - ((t.total - min) / range) * (height - 12) - 6;
      return { x, y };
    });
    const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const fillD = `${lineD} L${width},${height} L0,${height} Z`;
    return { lineD, fillD, width, height };
  }, [totals]);

  const empty = snapshots.length === 0;

  return (
    <div className="anim-fade-up">
      <SectionHeader
        label="NET WORTH"
        right={
          <div className="flex items-center gap-3">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: PALETTE.success }} />
            <span>LIVE</span>
          </div>
        }
        accent={PALETTE.success}
      />

      <div
        className="rounded-2xl px-6 py-6"
        style={{
          background: "rgba(255,255,255,0.02)",
          border:     "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600 font-semibold mb-1">
              Total net worth
            </div>
            <div
              className="text-5xl lg:text-6xl font-black tabular-nums tracking-[-0.04em] leading-none"
              style={{ color: empty ? PALETTE.dim : "#fafafa" }}
            >
              {empty ? "—" : fmt(latestTotal)}
            </div>
          </div>

          {!empty && (
            <div className="flex items-center gap-2">
              {delta30 != null && (
                <DeltaPill value={delta30} suffix="30D" />
              )}
              {deltaPct != null && (
                <DeltaPill value={deltaPct} suffix="1Y" />
              )}
            </div>
          )}
        </div>

        {/* Sparkline */}
        {sparkline && (
          <div className="mt-5 -mx-6 -mb-6">
            <svg
              viewBox={`0 0 ${sparkline.width} ${sparkline.height}`}
              preserveAspectRatio="none"
              className="w-full"
              style={{ height: 80 }}
            >
              <defs>
                <linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={PALETTE.success} stopOpacity="0.30" />
                  <stop offset="100%" stopColor={PALETTE.success} stopOpacity="0.00" />
                </linearGradient>
              </defs>
              <path d={sparkline.fillD} fill="url(#nw-grad)" />
              <path d={sparkline.lineD} fill="none" stroke={PALETTE.success} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {empty && (
          <p className={`${TYPE.caption} mt-4`}>
            No snapshots yet. Use the breakdown below to enter your first month.
          </p>
        )}
      </div>
    </div>
  );
}

function DeltaPill({ value, suffix }: { value: number; suffix: string }) {
  const positive = value >= 0;
  const color = positive ? PALETTE.success : PALETTE.danger;
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md"
      style={{
        background: `${color}14`,
        border:     `1px solid ${color}40`,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d={positive ? "M2 7 L5 3 L8 7" : "M2 3 L5 7 L8 3"} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[10px] font-semibold tabular-nums tracking-tight" style={{ color }}>
        {positive ? "+" : ""}{value}%
      </span>
      <span className="text-[9px] uppercase tracking-[0.18em] font-semibold text-zinc-500">
        · {suffix}
      </span>
    </div>
  );
}
