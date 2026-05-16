"use client";

import Card from "@/components/ui/Card";
import { PALETTE, TYPE } from "@/lib/design-tokens";
import type { Business, BusinessStatus } from "@/hooks/useBusinesses";

// One business at a glance. Tap to open detail sheet. Status chip on the
// left, name + key metrics in the middle, MRR on the right. Designed to
// stack vertically — 3-5 of these on the page should still read clean.

const STATUS_COLOR: Record<BusinessStatus, string> = {
  idea:     PALETTE.dim,
  building: PALETTE.info,
  live:     PALETTE.success,
  growing:  PALETTE.success,
  paused:   PALETTE.warning,
};

const STATUS_LABEL: Record<BusinessStatus, string> = {
  idea:     "idea",
  building: "building",
  live:     "live",
  growing:  "growing",
  paused:   "paused",
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `$${Math.round(n / 1000)}k`;
  if (n >= 1_000)     return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export default function BusinessCard({
  business,
  onOpen,
}: {
  business: Business;
  onOpen: () => void;
}) {
  const color = STATUS_COLOR[business.status];

  return (
    <Card>
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-start gap-3">
          {/* Status dot */}
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
            style={{ background: color, boxShadow: `0 0 0 3px ${color}22` }}
            aria-label={business.status}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-zinc-100">{business.name}</span>
              <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color }}>
                {STATUS_LABEL[business.status]}
              </span>
              {business.category && (
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                  {business.category}
                </span>
              )}
            </div>

            {/* Money + customers row — only when there's real revenue or customers */}
            {(business.monthly_revenue > 0 || business.customer_count > 0) && (
              <div className="mt-1 flex items-baseline gap-3 text-[12px] text-zinc-400 tabular-nums">
                {business.monthly_revenue > 0 && (
                  <span className="font-semibold text-zinc-100">{fmtMoney(business.monthly_revenue)}<span className="text-zinc-500 font-normal">/mo</span></span>
                )}
                {business.customer_count > 0 && (
                  <span>{business.customer_count} {business.customer_count === 1 ? "customer" : "customers"}</span>
                )}
              </div>
            )}

            {/* Next action — the one thing this business needs */}
            {business.next_action && (
              <p className="mt-1.5 text-[12px] text-zinc-300 leading-snug">
                <span className={`${TYPE.label} mr-1`}>Next</span>
                {business.next_action}
              </p>
            )}
          </div>
        </div>
      </button>
    </Card>
  );
}
