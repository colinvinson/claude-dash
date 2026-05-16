"use client";

import SectionLabel from "@/components/layout/SectionLabel";
import StrategySection  from "@/components/finances/StrategySection";
import WishlistSection  from "@/components/finances/WishlistSection";
import CashFlowSection  from "@/components/finances/CashFlowSection";
import NetWorthSection  from "@/components/finances/NetWorthSection";

// Order is intentional: STRATEGY (the decision) → WANTS (where the
// money is being asked to go) → CASH FLOW (what's coming in / out)
// → NET WORTH (the long arc, collapsed by default).
//
// Net worth is the lowest-priority surface visually — it's the most
// tempting to stare at and the least actionable. Strategy + Wants
// drive actual decisions, so they earn the top of the page.
export default function FinancesView() {
  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <SectionLabel>Finances</SectionLabel>
      </div>
      <div className="anim-fade-up stagger-1"><StrategySection /></div>
      <div className="anim-fade-up stagger-2"><WishlistSection /></div>
      <div className="anim-fade-up stagger-3"><CashFlowSection /></div>
      <div className="anim-fade-up stagger-3"><NetWorthSection /></div>
    </div>
  );
}
