"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import { useLongTermGoals, type GoalBucket } from "@/hooks/useLongTermGoals";
import GoalWidget from "./GoalWidget";

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function GoalsList({ bucket }: { bucket: GoalBucket }) {
  const { goals, loading, addGoal, updateGoal, archiveGoal, linkItem, refreshAiSummary } = useLongTermGoals(bucket);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state for adding a new goal in this bucket.
  const [newTitle, setNewTitle]       = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDate, setNewDate]         = useState("");
  const [adding, setAdding]           = useState(false);

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

  async function handleAdd() {
    if (!newTitle.trim()) return;
    setAdding(true);
    await addGoal({ title: newTitle, bucket, category: newCategory.trim() || undefined, target_date: newDate || undefined });
    setNewTitle(""); setNewCategory(""); setNewDate("");
    setAdding(false);
  }

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
          <p className="text-sm text-zinc-400">
            No {bucket === "business" ? "businesses" : "life goals"} yet. Add one below.
          </p>
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
        />
      ))}

      {/* Add new */}
      <Card>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">
          {bucket === "business" ? "Add a business / project" : "Add a life goal"}
        </span>
        <div className="space-y-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={bucket === "business" ? "e.g. Ship SaaS v1" : "e.g. Get tan"}
            className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
          />
          <div className="flex gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Tag (optional)"
              className="flex-1 bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            />
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-44 bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="w-full py-2 bg-white text-zinc-900 disabled:opacity-40 rounded-xl text-sm font-semibold transition-opacity flex items-center justify-center gap-1"
          >
            <Plus size={14} /> {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </Card>
    </div>
  );
}
