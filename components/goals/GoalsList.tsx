"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Target, Briefcase } from "lucide-react";
import { useLongTermGoals, type GoalBucket } from "@/hooks/useLongTermGoals";
import GoalWidget from "./GoalWidget";
import AddGoalFlow from "./AddGoalFlow";

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Renders goals filtered by bucket and (optionally) by businessId.
//   businessId="<uuid>"  → only goals tied to that specific business.
//                          New goals added from here auto-link to it.
//   businessId={null}    → only UNASSIGNED business-bucket goals.
//   businessId omitted   → all goals in bucket (existing behavior).
export default function GoalsList({
  bucket,
  businessId,
}: {
  bucket:      GoalBucket;
  businessId?: string | null;
}) {
  const { goals, loading, addGoal, updateGoal, archiveGoal, deleteGoal, linkItem, refreshAiSummary, suggestPlan, toggleFocus } = useLongTermGoals(bucket, businessId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (loading || goals.length === 0) return;
    const now = Date.now();
    for (const g of goals) {
      const updatedAt = g.ai_summary_updated_at ? new Date(g.ai_summary_updated_at).getTime() : 0;
      if (now - updatedAt > STALE_AFTER_MS) {
        void refreshAiSummary(g.id, false).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bucket, businessId, goals.length]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map((i) => <div key={i} className="h-24 bg-zinc-900 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  // Empty state when scoped to a specific business is more compact than
  // the top-level no-bucket empty state — adding a goal from inside a
  // business is a follow-on action, not the primary one.
  const isBusinessScoped = typeof businessId === "string";

  return (
    <div className="space-y-3">
      {goals.length === 0 && !isBusinessScoped && (
        <Card>
          <EmptyState
            icon={bucket === "business" ? Briefcase : Target}
            title={bucket === "business" ? "No businesses yet" : "No life goals yet"}
            description="Add one below to start tracking."
          />
        </Card>
      )}
      {goals.length === 0 && isBusinessScoped && (
        <p className="text-[11px] text-zinc-500 italic">No goals tied to this business yet.</p>
      )}

      {goals.map((g) => (
        <GoalWidget
          key={g.id}
          goal={g}
          isExpanded={expandedId === g.id}
          onToggleExpand={() => setExpandedId((cur) => cur === g.id ? null : g.id)}
          onUpdate={updateGoal}
          onArchive={archiveGoal}
          onDelete={deleteGoal}
          onLinkItem={linkItem}
          onRefreshSummary={refreshAiSummary}
          onSuggestPlan={suggestPlan}
          onToggleFocus={toggleFocus}
        />
      ))}

      <AddGoalFlow
        bucket={bucket}
        businessId={isBusinessScoped ? (businessId as string) : null}
        onCreate={addGoal}
        onUpdate={updateGoal}
      />
    </div>
  );
}
