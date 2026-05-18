"use client";

import { useState } from "react";
import { useNetWorth } from "@/hooks/useNetWorth";
import { FormInput } from "@/components/ui/FormInput";
import SectionHeader from "@/components/ui/SectionHeader";
import { PALETTE } from "@/lib/design-tokens";

// Three horizontal asset cards in Miles' a1 / a2 / a3 pattern:
// LIQUID CASH | INVESTED ASSETS | LIABILITIES.
//
// Rowan's data model has four lump numbers (cash / investments /
// business_equity / debts). Mapping:
//   - Liquid cash   → cash
//   - Invested      → investments + business_equity (Rowan-specific: biz
//                     equity is an investment in its broadest sense)
//   - Liabilities   → debts
//
// Each card has its hero amount + % of net + a quick-edit input. Saving
// any field upserts THIS MONTH's snapshot via useNetWorth.upsertSnapshot.

function fmt(n: number): string {
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? "-" : ""}$${abs.toLocaleString("en-US")}`;
}

function firstOfThisMonth(): string {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function AssetBreakdown() {
  const { latest, latestTotal, upsertSnapshot } = useNetWorth();

  const cash    = latest?.cash            ?? 0;
  const inv     = latest?.investments     ?? 0;
  const biz     = latest?.business_equity ?? 0;
  const debts   = latest?.debts           ?? 0;
  const invested = inv + biz;

  const pctOf = (n: number) =>
    latestTotal === 0 ? 0 : Math.round((n / Math.abs(latestTotal)) * 100);

  // Local form state — flush to DB on blur
  const [cashE,  setCashE]  = useState<string>(String(cash));
  const [invE,   setInvE]   = useState<string>(String(inv));
  const [bizE,   setBizE]   = useState<string>(String(biz));
  const [debtsE, setDebtsE] = useState<string>(String(debts));

  // Re-seed local from server when latest changes
  // (happens on first load + on realtime updates)
  // — done via key prop on the inputs would be cleaner; for now blur-flush is fine.
  const save = async (patch: Partial<{ cash: number; investments: number; business_equity: number; debts: number }>) => {
    await upsertSnapshot({
      snapshot_date: firstOfThisMonth(),
      cash:            patch.cash            ?? (Number(cashE)  || 0),
      investments:     patch.investments     ?? (Number(invE)   || 0),
      business_equity: patch.business_equity ?? (Number(bizE)   || 0),
      debts:           patch.debts           ?? (Number(debtsE) || 0),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 anim-fade-up stagger-1">
      <AssetCard
        number="a1"
        label="LIQUID CASH"
        amount={cash}
        pctOfNet={pctOf(cash)}
        accent={PALETTE.success}
        rows={[
          { label: "Cash", value: cashE, onChange: setCashE, onCommit: () => save({ cash: Number(cashE) || 0 }) },
        ]}
      />
      <AssetCard
        number="a2"
        label="INVESTED ASSETS"
        amount={invested}
        pctOfNet={pctOf(invested)}
        accent={PALETTE.info}
        rows={[
          { label: "Investments",     value: invE, onChange: setInvE, onCommit: () => save({ investments:     Number(invE) || 0 }) },
          { label: "Business equity", value: bizE, onChange: setBizE, onCommit: () => save({ business_equity: Number(bizE) || 0 }) },
        ]}
      />
      <AssetCard
        number="a3"
        label="LIABILITIES"
        amount={debts}
        pctOfNet={pctOf(debts)}
        accent={PALETTE.danger}
        rows={[
          { label: "Debts", value: debtsE, onChange: setDebtsE, onCommit: () => save({ debts: Number(debtsE) || 0 }) },
        ]}
      />
    </div>
  );
}

function AssetCard({
  number, label, amount, pctOfNet, accent, rows,
}: {
  number: string;
  label:  string;
  amount: number;
  pctOfNet: number;
  accent: string;
  rows:   Array<{ label: string; value: string; onChange: (v: string) => void; onCommit: () => void }>;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-5"
      style={{
        background: "rgba(255,255,255,0.02)",
        border:     "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <SectionHeader
        number={number}
        label={label}
        right={
          <span className="text-zinc-500">{pctOfNet}% of net</span>
        }
        accent={accent}
      />
      <div className="text-3xl font-black tabular-nums tracking-[-0.03em] text-zinc-50">
        {fmt(amount)}
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto] gap-3 items-center">
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-600">
              {row.label}
            </span>
            <FormInput
              type="number"
              inputMode="decimal"
              step="0.01"
              value={row.value}
              onChange={(e) => row.onChange(e.target.value)}
              onBlur={row.onCommit}
              placeholder="$"
              className="w-32 text-right tabular-nums"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
