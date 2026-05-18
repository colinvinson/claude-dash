"use client";

import { useNetWorth } from "@/hooks/useNetWorth";
import SectionHeader from "@/components/ui/SectionHeader";
import { PALETTE } from "@/lib/design-tokens";

// a4 — Snapshot history table. Monthly rows of net worth + breakdown.
// Δ vs prior column computed on the fly. Sorted newest first.

function fmt(n: number): string {
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? "-" : ""}$${abs.toLocaleString("en-US")}`;
}

function monthLabel(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function SnapshotHistory() {
  const { snapshots } = useNetWorth();

  if (snapshots.length === 0) return null;

  // newest first
  const rows = [...snapshots].reverse().map((s, i, arr) => {
    const total = s.cash + s.investments + s.business_equity - s.debts;
    const liquid = s.cash;
    const invested = s.investments + s.business_equity;
    const liabilities = s.debts;
    const next = arr[i + 1];
    const nextTotal = next ? (next.cash + next.investments + next.business_equity - next.debts) : null;
    const delta = nextTotal == null ? null : (total - nextTotal);
    return {
      id: s.id,
      period: monthLabel(s.snapshot_date),
      total,
      liquid,
      invested,
      liabilities,
      delta,
    };
  });

  return (
    <div className="anim-fade-up stagger-2">
      <SectionHeader
        number="a4"
        label="SNAPSHOT HISTORY"
        right={<span>MONTHLY · {rows.length}MO</span>}
      />
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border:     "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[9px] uppercase tracking-[0.18em] font-semibold text-zinc-600">
              <th className="text-left  px-4 py-2.5 font-semibold">Period</th>
              <th className="text-right px-4 py-2.5 font-semibold">Net Worth</th>
              <th className="text-right px-4 py-2.5 font-semibold hidden md:table-cell">Liquid</th>
              <th className="text-right px-4 py-2.5 font-semibold hidden md:table-cell">Invested</th>
              <th className="text-right px-4 py-2.5 font-semibold hidden lg:table-cell">Liabilities</th>
              <th className="text-right px-4 py-2.5 font-semibold">Δ vs Prior</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                <td className="px-4 py-2.5 text-zinc-400">{r.period}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-zinc-100">{fmt(r.total)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500 hidden md:table-cell">{fmt(r.liquid)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500 hidden md:table-cell">{fmt(r.invested)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500 hidden lg:table-cell">{fmt(r.liabilities)}</td>
                <td
                  className="px-4 py-2.5 text-right tabular-nums font-semibold"
                  style={{ color: r.delta == null ? PALETTE.dim : r.delta >= 0 ? PALETTE.success : PALETTE.danger }}
                >
                  {r.delta == null ? "—" : `${r.delta >= 0 ? "+" : ""}${fmt(r.delta)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
