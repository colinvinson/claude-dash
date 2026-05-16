import type { Metadata } from "next";
import SectionLabel from "@/components/layout/SectionLabel";
import GoalsList from "@/components/goals/GoalsList";

export const metadata: Metadata = { title: "Businesses" };

// Businesses tab — long-term business / project goals. Companion to /life.
// Split off from the old /goals?tab=business URL into a top-level tab.
export default function BusinessesPage() {
  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <SectionLabel>Businesses</SectionLabel>
      </div>
      <div className="anim-fade-up stagger-1">
        <GoalsList bucket="business" />
      </div>
    </div>
  );
}
