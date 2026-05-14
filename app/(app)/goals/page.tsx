"use client";

import { useSearchParams } from "next/navigation";
import SectionLabel from "@/components/layout/SectionLabel";
import GoalsTabBar from "@/components/goals/GoalsTabBar";
import GoalsList from "@/components/goals/GoalsList";
import type { GoalBucket } from "@/hooks/useLongTermGoals";

export default function GoalsPage() {
  const params = useSearchParams();
  const raw = params.get("tab");
  // URL contract: ?tab=life | ?tab=business (default life).
  // DB mapping: "life" tab → bucket "personal"; "business" tab → bucket "business".
  const activeTab: "life" | "business" = raw === "business" ? "business" : "life";
  const bucket: GoalBucket = activeTab === "business" ? "business" : "personal";

  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <SectionLabel>Goals</SectionLabel>
      </div>

      <GoalsTabBar activeTab={activeTab} />

      <div className="anim-fade-up stagger-1">
        <GoalsList bucket={bucket} />
      </div>
    </div>
  );
}
