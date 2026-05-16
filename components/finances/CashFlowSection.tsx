"use client";

import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { useMoneyFlow } from "@/hooks/useMoneyFlow";
import { PALETTE, TYPE } from "@/lib/design-tokens";

// Cash flow — aggregate view of money_logs Sir already logs daily via
// LogSheet. Surfaces the data that's been silently dying on entry
// since migration 0024. Last 30d + 90d totals + per-category split.
//
// No new logging surface — keep the LogSheet money tile as the single
// entry point. This is purely the read view.

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000) return `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1000).toFixed(1)}k`;
  return `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n))}`;
}

export default function CashFlowSection() {
  const { summary, loading } = useMoneyFlow();

  if (loading) return null;

  const empty = summary.income30d === 0 && summary.expense30d === 0 && summary.income90d === 0 && summary.expense90d === 0;

  return (
    <Card variant="primary">
      <CollapsibleSection label="Cash flow" defaultOpen={!empty}>
        {empty ? (
          <p className="text-[11px] text-zinc-500 leading-snug">
            No money logged yet. Open the log sheet (the + button on Home) → Money tile to track income / expenses. Once you have data here it shows up automatically.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <StatBlock label="In (30d)"  value={summary.income30d}  color={PALETTE.success} />
              <StatBlock label="Out (30d)" value={summary.expense30d} color={PALETTE.danger} />
              <StatBlock
                label="Net (30d)"
                value={summary.net30d}
                color={summary.net30d >= 0 ? PALETTE.success : PALETTE.danger}
                bold
              />
            </div>

            <div className="grid grid-cols-3 gap-3 text-[10px]">
              <SubStat label="In 90d"  value={summary.income90d}  />
              <SubStat label="Out 90d" value={summary.expense90d} />
              <SubStat
                label="Net 90d"
                value={summary.net90d}
                color={summary.net90d >= 0 ? PALETTE.success : PALETTE.danger}
              />
            </div>

            {summary.byCategory30d.length > 0 && (
              <div>
                <span className={`${TYPE.label} block mb-1.5`}>Top categories · 30d</span>
                <div className="space-y-1">
                  {summary.byCategory30d.map((c) => (
                    <div key={c.category} className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-300 capitalize flex-1 truncate">{c.category}</span>
                      <span className="text-[11px] tabular-nums" style={{ color: c.kind === "income" ? PALETTE.success : PALETTE.dim }}>
                        {fmt(c.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>
    </Card>
  );
}

function StatBlock({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  return (
    <div>
      <div className={TYPE.label}>{label}</div>
      <div className={`tabular-nums ${bold ? "text-xl font-bold" : "text-base font-semibold"}`} style={{ color }}>
        {fmt(value)}
      </div>
    </div>
  );
}

function SubStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="text-zinc-600 uppercase tracking-widest text-[9px]">{label}</div>
      <div className="tabular-nums text-zinc-300" style={{ color }}>{fmt(value)}</div>
    </div>
  );
}
