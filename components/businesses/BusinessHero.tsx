"use client";

import Card from "@/components/ui/Card";
import { PALETTE, TYPE } from "@/lib/design-tokens";
import { useBusinesses } from "@/hooks/useBusinesses";

// Page-top summary strip — total MRR across the portfolio, customer count,
// how many are live. The number that matters most (MRR) anchors the card
// as a hero metric so the businesses tab opens on "here's where you are
// right now."

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `$${Math.round(n / 1000)}k`;
  if (n >= 1_000)     return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export default function BusinessHero() {
  const { businesses, totalMRR, totalCustomers, liveCount, loading } = useBusinesses();

  if (loading) return null;

  // Fastest-growing — sort live/growing businesses by MoM proxy
  // (monthly_revenue / created_at age). Skipped if no live businesses.
  const fastest = (() => {
    const live = businesses.filter((b) => b.status === "live" || b.status === "growing");
    if (live.length === 0) return null;
    return [...live].sort((a, b) => b.monthly_revenue - a.monthly_revenue)[0];
  })();

  return (
    <Card>
      <div className="flex items-baseline gap-3 mb-1">
        <span className={TYPE.label}>Total MRR</span>
        {liveCount > 0 && (
          <span className="text-[10px] text-zinc-500">
            {liveCount} {liveCount === 1 ? "business" : "businesses"} live
          </span>
        )}
      </div>
      <div className="flex items-end gap-3">
        <span className="text-4xl font-black tabular-nums leading-none" style={{ color: totalMRR > 0 ? PALETTE.success : PALETTE.dim }}>
          {fmtMoney(totalMRR)}
        </span>
        <span className="text-xs text-zinc-500 pb-1">/mo</span>
        {totalCustomers > 0 && (
          <span className="text-xs text-zinc-500 pb-1 ml-auto tabular-nums">
            {totalCustomers} customer{totalCustomers === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {fastest && businesses.length > 1 && (
        <p className="text-[11px] text-zinc-500 mt-2">
          Top earner: <span className="text-zinc-300">{fastest.name}</span> · {fmtMoney(fastest.monthly_revenue)}/mo
        </p>
      )}
    </Card>
  );
}
