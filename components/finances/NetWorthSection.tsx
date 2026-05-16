"use client";

import { useMemo, useState } from "react";
import { TrendingUp, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import { useNetWorth } from "@/hooks/useNetWorth";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";

// Net worth monthly snapshot. Deliberately NOT the hero of the
// Finances page — vanity metric if it dominates. Lives as a
// collapsible section: collapsed shows latest + trajectory delta;
// expanded reveals the entry form + trajectory sparkline.

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1000).toFixed(1)}k`;
  return `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n))}`;
}

function firstOfThisMonth(): string {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function NetWorthSection() {
  const { snapshots, latest, latestTotal, totals, deltaPct, upsertSnapshot } = useNetWorth();
  const [editing, setEditing] = useState(false);
  const [cash, setCash]       = useState(latest ? String(latest.cash) : "");
  const [inv, setInv]         = useState(latest ? String(latest.investments) : "");
  const [biz, setBiz]         = useState(latest ? String(latest.business_equity) : "");
  const [debts, setDebts]     = useState(latest ? String(latest.debts) : "");
  const [notes, setNotes]     = useState(latest?.notes ?? "");
  const [busy, setBusy]       = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    await upsertSnapshot({
      snapshot_date:    firstOfThisMonth(),
      cash:             parseFloat(cash)  || 0,
      investments:      parseFloat(inv)   || 0,
      business_equity:  parseFloat(biz)   || 0,
      debts:            parseFloat(debts) || 0,
      notes:            notes || null,
    });
    setBusy(false);
    setEditing(false);
  }

  // Inline mini sparkline
  const path = useMemo(() => {
    if (totals.length < 2) return null;
    const width  = 80;
    const height = 24;
    const max = Math.max(...totals.map((t) => t.total), 1);
    const min = Math.min(...totals.map((t) => t.total), 0);
    const range = Math.max(max - min, 1);
    const xs = totals.map((_, i) => (i / (totals.length - 1)) * width);
    const ys = totals.map((t) => height - ((t.total - min) / range) * (height - 4) - 2);
    return { d: xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" "), width, height };
  }, [totals]);

  const dim = latestTotal === 0;

  return (
    <Card variant="primary">
      <CollapsibleSection
        label="Net worth"
        count={snapshots.length}
        defaultOpen={false}
      >
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-2xl font-bold tabular-nums" style={{ color: dim ? PALETTE.dim : PALETTE.success }}>
              {fmt(latestTotal)}
            </span>
            {deltaPct != null && (
              <span className="text-[11px] tabular-nums flex items-center gap-1 pb-1" style={{ color: deltaPct >= 0 ? PALETTE.success : PALETTE.danger }}>
                <TrendingUp size={ICON.xs} style={{ transform: deltaPct < 0 ? "scaleY(-1)" : undefined }} />
                {deltaPct >= 0 ? "+" : ""}{deltaPct}% yr
              </span>
            )}
            {path && (
              <svg width={path.width} height={path.height} className="ml-auto">
                <path d={path.d} fill="none" stroke={PALETTE.success} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            )}
          </div>

          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs font-semibold hover:border-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <Plus size={ICON.xs} />
              {latest ? "Update this month's snapshot" : "Enter first snapshot"}
            </button>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FormLabel>Cash</FormLabel>
                  <FormInput type="number" inputMode="decimal" step="0.01" value={cash}  onChange={(e) => setCash(e.target.value)}  placeholder="$" />
                </div>
                <div>
                  <FormLabel>Investments</FormLabel>
                  <FormInput type="number" inputMode="decimal" step="0.01" value={inv}   onChange={(e) => setInv(e.target.value)}   placeholder="$" />
                </div>
                <div>
                  <FormLabel>Business equity</FormLabel>
                  <FormInput type="number" inputMode="decimal" step="0.01" value={biz}   onChange={(e) => setBiz(e.target.value)}   placeholder="$" />
                </div>
                <div>
                  <FormLabel>Debts</FormLabel>
                  <FormInput type="number" inputMode="decimal" step="0.01" value={debts} onChange={(e) => setDebts(e.target.value)} placeholder="$" />
                </div>
              </div>
              <FormTextarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note (what changed this month)" />
              <p className="text-[10px] text-zinc-600 leading-snug">
                Pull the cash + investments numbers from ChatGPT or your bank app. Type them here. Business equity = your rough valuation of your businesses (or just 0 if early). One row per month.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                <Button variant="primary"   size="sm" fullWidth onClick={save} loading={busy}>Save snapshot</Button>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </Card>
  );
}
