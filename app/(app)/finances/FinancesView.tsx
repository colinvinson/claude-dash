"use client";

import NetWorthHero    from "@/components/finances/NetWorthHero";
import AssetBreakdown  from "@/components/finances/AssetBreakdown";
import SnapshotHistory from "@/components/finances/SnapshotHistory";
import StrategySection from "@/components/finances/StrategySection";
import WishlistSection from "@/components/finances/WishlistSection";
import CashFlowSection from "@/components/finances/CashFlowSection";

// Finances tab — restructured to match the Miles OS Finance layout
// (Phase 1 visual merge).
//
// Top: net worth hero (full width, big number + sparkline + delta pills)
// Middle: asset breakdown (3 horizontal cards — cash / invested / debts)
// Below: snapshot history (monthly table)
// Bottom: Rowan-unique surfaces preserved — Strategy / Wishlist / CashFlow.
//
// Net worth got promoted from a collapsed footnote to the page hero
// because the screenshot Sir referenced makes it THE focal element.
// Strategy still anchors the decision layer — just below the snapshot
// stack so the page reads top-down: where am I → what's there → what
// to do about it.

export default function FinancesView() {
  return (
    <div className="space-y-6">
      <NetWorthHero />
      <AssetBreakdown />
      <SnapshotHistory />
      <div className="anim-fade-up stagger-3"><StrategySection /></div>
      <div className="anim-fade-up stagger-3"><WishlistSection /></div>
      <div className="anim-fade-up stagger-3"><CashFlowSection /></div>
    </div>
  );
}
