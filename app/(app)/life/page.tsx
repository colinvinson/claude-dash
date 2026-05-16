import type { Metadata } from "next";
import SectionLabel from "@/components/layout/SectionLabel";
import GoalsList from "@/components/goals/GoalsList";

export const metadata: Metadata = { title: "Life" };

// Life goals — long-term personal goals. Companion to /businesses.
// Split off from the old /goals?tab=life URL into a top-level tab so
// goals feel central to the dashboard, not buried inside a sub-tab.
export default function LifePage() {
  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <SectionLabel>Life goals</SectionLabel>
      </div>
      <div className="anim-fade-up stagger-1">
        <GoalsList bucket="personal" />
      </div>
    </div>
  );
}
