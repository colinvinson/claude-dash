"use client";

import { useState } from "react";
import { useBusinesses, type Business } from "@/hooks/useBusinesses";
import SectionLabel from "@/components/layout/SectionLabel";
import BusinessHero from "@/components/businesses/BusinessHero";
import BusinessCard from "@/components/businesses/BusinessCard";
import BusinessDetail from "@/components/businesses/BusinessDetail";
import AddBusinessFlow from "@/components/businesses/AddBusinessFlow";
import GoalsList from "@/components/goals/GoalsList";

// Live/growing surface first (the ones doing real work), then build /
// idea / paused. Within a status, biggest MRR first.
const STATUS_ORDER: Business["status"][] = ["growing", "live", "building", "idea", "paused"];

export default function BusinessesView() {
  const { businesses, loading, staleIds, topTasks } = useBusinesses();
  const [openId, setOpenId] = useState<string | null>(null);
  const openBusiness = openId ? businesses.find((b) => b.id === openId) ?? null : null;

  const sorted = [...businesses].sort((a, b) => {
    const aRank = STATUS_ORDER.indexOf(a.status);
    const bRank = STATUS_ORDER.indexOf(b.status);
    if (aRank !== bRank) return aRank - bRank;
    return b.monthly_revenue - a.monthly_revenue;
  });

  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <SectionLabel>Businesses</SectionLabel>
      </div>

      <div className="anim-fade-up stagger-1">
        <BusinessHero />
      </div>

      {!loading && sorted.length === 0 && (
        <div className="anim-fade-up stagger-2 text-center py-6 text-xs text-zinc-500">
          No businesses tracked yet. Add your first below — even ideas count.
        </div>
      )}

      <div className="anim-fade-up stagger-2 space-y-3">
        {sorted.map((b) => (
          <BusinessCard
            key={b.id}
            business={b}
            topTask={topTasks.get(b.id) ?? null}
            stale={staleIds.has(b.id)}
            onOpen={() => setOpenId(b.id)}
          />
        ))}
      </div>

      <div className="anim-fade-up stagger-3">
        <AddBusinessFlow />
      </div>

      {/* Business GOALS still live as their own section. The portfolio is
          for "what businesses exist + how are they doing"; goals are for
          "what am I trying to hit." */}
      <div className="anim-fade-up stagger-3 pt-6">
        <SectionLabel>Business goals</SectionLabel>
      </div>
      <div className="anim-fade-up stagger-3">
        <GoalsList bucket="business" />
      </div>

      {openBusiness && (
        <BusinessDetail business={openBusiness} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
