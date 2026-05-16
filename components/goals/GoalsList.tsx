"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Target, Briefcase } from "lucide-react";
import { useLongTermGoals, type GoalBucket } from "@/hooks/useLongTermGoals";
import GoalWidget from "./GoalWidget";
import AddGoalFlow from "./AddGoalFlow";

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function GoalsList({ bucket }: { bucket: GoalBucket }) {
  const { goals, loading, addGoal, updateGoal, archiveGoal, linkItem, refreshAiSummary, suggestPlan, toggleFocus } = useLongTermGoals(bucket);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Lazy weekly auto-refresh: when the page mounts (or bucket changes),
  // fire a background goal-summary call for any goal whose ai_summary is
  // null OR older than 7 days. Fire-and-forget; updates flow back via load().
  useEffect(() => {
    if (loading || goals.length === 0) return;
    const now = Date.now();
    for (const g of goals) {
      const updatedAt = g.ai_summary_updated_at ? new Date(g.ai_summary_updated_at).getTime() : 0;
      if (now - updatedAt > STALE_AFTER_MS) {
        // Don't await — these are independent background tasks.
        void refreshAiSummary(g.id, false).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bucket, goals.length]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map((i) => <div key={i} className="h-24 bg-zinc-900 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {goals.length === 0 && (
        <Card>
          <EmptyState
            icon={bucket === "business" ? Briefcase : Target}
            title={bucket === "business" ? "No businesses yet" : "No life goals yet"}
            description="Add one below to start tracking."
          />
        </Card>
      )}

      {goals.map((g) => (
        <GoalWidget
          key={g.id}
          goal={g}
          isExpanded={expandedId === g.id}
          onToggleExpand={() => setExpandedId((cur) => cur === g.id ? null : g.id)}
          onUpdate={updateGoal}
          onArchive={archiveGoal}
          onLinkItem={linkItem}
          onRefreshSummary={refreshAiSummary}
          onSuggestPlan={suggestPlan}
          onToggleFocus={toggleFocus}
        />
      ))}

      {/* Add — onboarding fork between manual and Jarvis-drafted protocol */}
      <AddGoalFlow bucket={bucket} onCreate={addGoal} onUpdate={updateGoal} />
    </div>
  );
}
