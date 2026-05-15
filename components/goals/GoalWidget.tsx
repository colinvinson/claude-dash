"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Archive, Plus, RotateCcw, ArrowRightLeft } from "lucide-react";
import Card from "@/components/ui/Card";
import { useStack } from "@/hooks/useStack";
import { useStackInsights } from "@/hooks/useStackInsights";
import type { LongTermGoal } from "@/hooks/useLongTermGoals";
import LinkRoutinePicker from "./LinkRoutinePicker";

type Props = {
  goal: LongTermGoal;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, patch: Partial<LongTermGoal>) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onLinkItem: (itemId: string, goalId: string | null) => Promise<void>;
  onRefreshSummary: (id: string, force?: boolean) => Promise<string | null>;
  onSuggestPlan: (id: string) => Promise<string | null>;
};

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function GoalWidget({
  goal, isExpanded, onToggleExpand, onUpdate, onArchive, onLinkItem, onRefreshSummary, onSuggestPlan,
}: Props) {
  const { items, toggle } = useStack();
  const { insights } = useStackInsights(items);

  const linkedItems = items.filter((i) => i.linked_goal_id === goal.id);
  const ratios = linkedItems
    .map((i) => insights[i.id]?.ratio7d)
    .filter((r): r is number => typeof r === "number");
  const overallProgress = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
  const progressPct = overallProgress != null ? Math.round(overallProgress * 100) : null;

  const [editingState, setEditingState]   = useState(goal.current_state ?? "");
  const [editingNext, setEditingNext]     = useState(goal.next_steps ?? "");
  const [editingPlan,  setEditingPlan]    = useState(goal.ai_action_plan ?? "");
  const [linkerOpen, setLinkerOpen]       = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [suggestingPlan, setSuggestingPlan] = useState(false);

  async function handleSuggestPlan() {
    if (suggestingPlan) return;
    setSuggestingPlan(true);
    const suggestion = await onSuggestPlan(goal.id);
    if (suggestion) setEditingPlan(suggestion);
    setSuggestingPlan(false);
  }

  const summaryAge = goal.ai_summary_updated_at
    ? Date.now() - new Date(goal.ai_summary_updated_at).getTime()
    : Infinity;
  const canRefresh = summaryAge > 60 * 60 * 1000; // 1h cooldown

  async function handleRefresh() {
    if (refreshing || !canRefresh) return;
    setRefreshing(true);
    try { await onRefreshSummary(goal.id, false); } finally { setRefreshing(false); }
  }

  const targetCountdown = goal.target_date ? (() => {
    const diff = new Date(goal.target_date).getTime() - Date.now();
    const days = Math.floor(diff / (24 * 3600 * 1000));
    if (days < 0) return `${-days}d overdue`;
    if (days === 0) return "today";
    if (days < 30) return `${days}d left`;
    return `${Math.floor(days / 30)}mo left`;
  })() : null;

  return (
    <Card>
      <button onClick={onToggleExpand} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-zinc-100">{goal.title}</span>
              {goal.category && (
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                  {goal.category}
                </span>
              )}
              {targetCountdown && (
                <span className="text-[10px] text-zinc-500 tabular-nums">{targetCountdown}</span>
              )}
            </div>
            {progressPct != null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, progressPct)}%`,
                      background: progressPct >= 70 ? "#34d399" : progressPct >= 40 ? "#fbbf24" : "#a1a1aa",
                      transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
                <span className="text-[11px] text-zinc-500 tabular-nums">{progressPct}%</span>
              </div>
            )}
            {progressPct == null && (
              <p className="text-[11px] text-zinc-500 mt-1.5">No routine items linked yet.</p>
            )}
          </div>
          {isExpanded
            ? <ChevronUp size={16} className="text-zinc-500 mt-0.5 flex-shrink-0" />
            : <ChevronDown size={16} className="text-zinc-500 mt-0.5 flex-shrink-0" />}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4">
          {/* Current state */}
          <div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Current state</span>
            <textarea
              value={editingState}
              onChange={(e) => setEditingState(e.target.value)}
              onBlur={() => editingState !== (goal.current_state ?? "") && onUpdate(goal.id, { current_state: editingState })}
              placeholder="Where things stand right now…"
              rows={2}
              className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700 resize-none italic"
            />
          </div>

          {/* Next steps */}
          <div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Next steps</span>
            <textarea
              value={editingNext}
              onChange={(e) => setEditingNext(e.target.value)}
              onBlur={() => editingNext !== (goal.next_steps ?? "") && onUpdate(goal.id, { next_steps: editingNext })}
              placeholder="What's next…"
              rows={3}
              className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700 resize-none"
            />
          </div>

          {/* Linked routine items */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Linked routine items</span>
              <button
                onClick={() => setLinkerOpen(true)}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                <Plus size={11} /> Link
              </button>
            </div>
            {linkedItems.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Nothing linked yet.</p>
            ) : (
              <div className="space-y-1">
                {linkedItems.map((item) => {
                  const ins = insights[item.id];
                  return (
                    <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-zinc-900/40">
                      <button
                        onClick={() => toggle(item.id, item.taken, item.log_id)}
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors mr-2 ${
                          item.taken ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"
                        }`}
                      >
                        {item.taken && (
                          <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth="2">
                            <path d="M1 4l2.5 2.5L9 1" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-sm truncate ${item.taken ? "text-zinc-500 line-through" : "text-zinc-200"}`}>
                        {item.name}
                      </span>
                      {ins && ins.expected7d > 0 && (
                        <span className="text-[10px] text-zinc-500 tabular-nums ml-2">{ins.done7d}/{ins.expected7d}</span>
                      )}
                      <button
                        onClick={() => onLinkItem(item.id, null)}
                        className="text-zinc-700 hover:text-red-400 text-[10px] ml-2"
                        title="Unlink"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Business metrics — schemaless key/value */}
          {goal.bucket === "business" && (
            <MetricsEditor
              metrics={goal.metrics ?? {}}
              onSave={(m) => onUpdate(goal.id, { metrics: m })}
            />
          )}

          {/* Jarvis's take */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                <Sparkles size={10} /> Jarvis&apos;s take
              </span>
              <button
                onClick={handleRefresh}
                disabled={refreshing || !canRefresh}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw size={10} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "thinking…" : "Refresh"}
              </button>
            </div>
            {goal.ai_summary ? (
              <p className="text-xs text-zinc-300 leading-relaxed">{goal.ai_summary}</p>
            ) : (
              <p className="text-[11px] text-zinc-500 italic">No summary yet. Tap Refresh.</p>
            )}
            {goal.ai_summary_updated_at && (
              <p className="text-[10px] text-zinc-600 mt-1">Updated {timeSince(goal.ai_summary_updated_at)}</p>
            )}
          </div>

          {/* My plan — fully manual. What Sir's doing / taking to hit the goal.
              The "Suggest with Jarvis" button is opt-in; never auto-fills. */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">My plan</span>
              <button
                onClick={handleSuggestPlan}
                disabled={suggestingPlan}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 disabled:opacity-40"
              >
                <Sparkles size={10} />
                {suggestingPlan ? "Drafting…" : (editingPlan.trim() ? "Replace with Jarvis draft" : "Suggest with Jarvis")}
              </button>
            </div>
            <textarea
              value={editingPlan}
              onChange={(e) => setEditingPlan(e.target.value)}
              onBlur={() => editingPlan !== (goal.ai_action_plan ?? "") && onUpdate(goal.id, { ai_action_plan: editingPlan })}
              placeholder="What specifically you're doing / taking to get there. Substances, training, habits, milestones."
              rows={4}
              className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700 resize-y whitespace-pre-wrap"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
            <button
              onClick={() => onUpdate(goal.id, { bucket: goal.bucket === "personal" ? "business" : "personal" })}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              <ArrowRightLeft size={11} />
              Move to {goal.bucket === "personal" ? "Businesses" : "Life"}
            </button>
            <button
              onClick={() => onArchive(goal.id)}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-400"
            >
              <Archive size={11} /> Archive
            </button>
          </div>
        </div>
      )}

      <LinkRoutinePicker
        goalId={goal.id}
        open={linkerOpen}
        onClose={() => setLinkerOpen(false)}
        onLink={async (itemId, gid) => { await onLinkItem(itemId, gid); }}
      />
    </Card>
  );
}

// Tiny schemaless metrics editor for business goals. Renders key/value rows;
// blank key OR blank value rows get pruned on save.
function MetricsEditor({
  metrics,
  onSave,
}: {
  metrics: Record<string, unknown>;
  onSave: (m: Record<string, unknown>) => Promise<void>;
}) {
  const initial = Object.entries(metrics).map(([k, v]) => ({ k, v: String(v) }));
  const [rows, setRows] = useState<Array<{ k: string; v: string }>>(
    initial.length > 0 ? initial : [{ k: "", v: "" }]
  );

  function update(i: number, field: "k" | "v", value: string) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setRows((prev) => [...prev, { k: "", v: "" }]);
  }

  async function save() {
    const obj: Record<string, unknown> = {};
    for (const r of rows) {
      if (!r.k.trim()) continue;
      // Numeric coercion if it parses cleanly, otherwise keep as string.
      const n = Number(r.v);
      obj[r.k.trim()] = !isNaN(n) && r.v.trim() !== "" ? n : r.v;
    }
    await onSave(obj);
  }

  return (
    <div>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">Metrics</span>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={r.k}
              onChange={(e) => update(i, "k", e.target.value)}
              onBlur={save}
              placeholder="MRR"
              className="flex-1 bg-zinc-900 text-zinc-100 rounded px-2 py-1.5 text-xs outline-none border border-zinc-800 focus:border-zinc-700"
            />
            <input
              value={r.v}
              onChange={(e) => update(i, "v", e.target.value)}
              onBlur={save}
              placeholder="$0"
              className="flex-1 bg-zinc-900 text-zinc-100 rounded px-2 py-1.5 text-xs outline-none border border-zinc-800 focus:border-zinc-700"
            />
          </div>
        ))}
        <button onClick={addRow} className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
          <Plus size={10} /> Add metric
        </button>
      </div>
    </div>
  );
}
