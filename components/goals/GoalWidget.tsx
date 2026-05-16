"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Archive, Plus, RotateCcw, ArrowRightLeft, Star, Target, Trash2, Check } from "lucide-react";
import Card from "@/components/ui/Card";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import CompletionToggle from "@/components/ui/CompletionToggle";
import { useStack } from "@/hooks/useStack";
import { useStackInsights } from "@/hooks/useStackInsights";
import { useGoalMilestones } from "@/hooks/useGoalMilestones";
import { useGoalMetrics } from "@/hooks/useGoalMetrics";
import type { LongTermGoal, GoalType } from "@/hooks/useLongTermGoals";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";
import LinkRoutinePicker from "./LinkRoutinePicker";
import LinkedChats from "@/components/businesses/LinkedChats";

type Props = {
  goal: LongTermGoal;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, patch: Partial<LongTermGoal>) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onLinkItem: (itemId: string, goalId: string | null) => Promise<void>;
  onRefreshSummary: (id: string, force?: boolean) => Promise<string | null>;
  onSuggestPlan: (id: string) => Promise<string | null>;
  onToggleFocus: (id: string) => Promise<void>;
};

const TYPE_LABEL: Record<GoalType, string> = {
  quantitative: "Quantitative",
  behavioral:   "Behavioral",
  project:      "Project",
  aesthetic:    "Aesthetic",
};

// Open-ended-goal rating. A goal without a deadline can't be "% complete" —
// there's no finish line. Instead we score how well the user is currently
// doing in that area and surface a qualitative chip. Prefers adherence
// (direct: "am I doing the work?") and falls back to metric trend
// (indirect: "is the number moving the right way?").
type RatingTier = "DIALED" | "STEADY" | "SLIPPING" | "STALLED";

function computeRating(args: {
  adherencePct:  number | null;
  ratePerWeek:   number;
  targetValue:   number | null;
  latest:        number | null;
  startingValue: number | null;
}): RatingTier | null {
  const { adherencePct, ratePerWeek, targetValue, latest, startingValue } = args;
  if (adherencePct != null) {
    if (adherencePct >= 75) return "DIALED";
    if (adherencePct >= 50) return "STEADY";
    if (adherencePct >= 25) return "SLIPPING";
    return "STALLED";
  }
  if (targetValue != null && latest != null && ratePerWeek !== 0) {
    const goingUp     = targetValue > (startingValue ?? latest);
    const movingRight = goingUp ? ratePerWeek > 0 : ratePerWeek < 0;
    if (!movingRight) return "SLIPPING";
    const remaining = Math.abs(targetValue - latest);
    const wks       = remaining / Math.abs(ratePerWeek);
    if (wks < 12) return "DIALED";
    if (wks < 52) return "STEADY";
    return "SLIPPING";
  }
  return null;
}

function ratingColor(tier: RatingTier): string {
  switch (tier) {
    case "DIALED":   return PALETTE.success;
    case "STEADY":   return PALETTE.info;
    case "SLIPPING": return PALETTE.warning;
    case "STALLED":  return PALETTE.danger;
  }
}

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
  goal, isExpanded, onToggleExpand, onUpdate, onArchive, onLinkItem, onRefreshSummary, onSuggestPlan, onToggleFocus,
}: Props) {
  const { items, toggle } = useStack();
  const { insights } = useStackInsights(items);
  const { milestones, addMilestone, toggleComplete: toggleMilestone, deleteMilestone } = useGoalMilestones(isExpanded ? goal.id : null);
  const { metrics, logMetric, deleteMetric, stats, projectedDays } = useGoalMetrics(isExpanded ? goal.id : null);

  const linkedItems = items.filter((i) => i.linked_goal_id === goal.id);
  const ratios = linkedItems
    .map((i) => insights[i.id]?.ratio7d)
    .filter((r): r is number => typeof r === "number");

  // Compute the "headline progress" — what number we show on the collapsed
  // card. Different per goal type:
  //   - quantitative: % of the way from starting_value → target_value
  //   - others:       7d adherence ratio of linked routine items
  const quantPct = goal.goal_type === "quantitative" && goal.target_value != null && stats.latest != null
    ? (() => {
        const start = goal.starting_value ?? stats.latest;
        const span  = goal.target_value - start;
        if (Math.abs(span) < 0.001) return 100;
        const done = stats.latest - start;
        return Math.round(Math.max(0, Math.min(1, done / span)) * 100);
      })()
    : null;
  const adherencePct = ratios.length > 0 ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length * 100) : null;
  const progressPct = quantPct ?? adherencePct;

  // Next pending milestone (sorted by target_date)
  const nextMilestone = milestones
    .filter((m) => !m.is_complete)
    .sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"))[0] ?? null;

  const [editingState, setEditingState]   = useState(goal.current_state ?? "");
  const [editingNext, setEditingNext]     = useState(goal.next_steps ?? "");
  const [editingPlan,  setEditingPlan]    = useState(goal.ai_action_plan ?? "");
  const [linkerOpen, setLinkerOpen]       = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [suggestingPlan, setSuggestingPlan] = useState(false);

  // New-milestone form
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate,  setNewMilestoneDate]  = useState("");

  // New-metric form
  const [metricDraft, setMetricDraft] = useState("");

  async function handleSuggestPlan() {
    if (suggestingPlan) return;
    setSuggestingPlan(true);
    const suggestion = await onSuggestPlan(goal.id);
    if (suggestion) setEditingPlan(suggestion);
    setSuggestingPlan(false);
  }

  async function handleAddMilestone() {
    if (!newMilestoneTitle.trim()) return;
    await addMilestone({ title: newMilestoneTitle, target_date: newMilestoneDate || null });
    setNewMilestoneTitle(""); setNewMilestoneDate("");
  }

  async function handleLogMetric() {
    const v = parseFloat(metricDraft);
    if (!isFinite(v)) return;
    await logMetric(v);
    setMetricDraft("");
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

  // Days to target via metric rate-of-change — only for quantitative goals
  // with at least 2 metric data points + a target.
  const projDays = goal.goal_type === "quantitative" && goal.target_value != null
    ? projectedDays(goal.target_value)
    : null;

  return (
    <Card>
      <button onClick={onToggleExpand} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Focus star — tap to toggle; surfaces this goal on Home */}
              <button
                onClick={(e) => { e.stopPropagation(); void onToggleFocus(goal.id); }}
                aria-label={goal.is_focus ? "Remove focus" : "Set as focus"}
                className="flex-shrink-0"
              >
                <Star
                  size={14}
                  className="transition-colors"
                  fill={goal.is_focus ? PALETTE.celebration : "transparent"}
                  style={{ color: goal.is_focus ? PALETTE.celebration : "rgb(82 82 91)" }}
                />
              </button>
              <span className="text-base font-semibold text-zinc-100">{goal.title}</span>
              <span
                className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{ color: PALETTE.dim, background: "rgba(255,255,255,0.04)" }}
              >
                {TYPE_LABEL[goal.goal_type]}
              </span>
              {goal.category && (
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                  {goal.category}
                </span>
              )}
              {targetCountdown && (
                <span className="text-[10px] text-zinc-500 tabular-nums">{targetCountdown}</span>
              )}
            </div>

            {/* Quantitative summary row */}
            {goal.goal_type === "quantitative" && goal.target_value != null && (
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-zinc-100 tabular-nums">
                  {stats.latest != null ? stats.latest : "—"}
                </span>
                <span className="text-[11px] text-zinc-500">→ {goal.target_value}{goal.metric_unit ? ` ${goal.metric_unit}` : ""}</span>
                {projDays != null && projDays > 0 && (
                  <span className="text-[10px] text-zinc-500 ml-1">· ~{projDays}d at current rate</span>
                )}
              </div>
            )}

            {/* Next milestone teaser (collapsed) */}
            {nextMilestone && (
              <div className="mt-1.5 text-[11px] text-zinc-500 truncate">
                Next: {nextMilestone.title}
                {nextMilestone.target_date && (
                  <span className="text-zinc-600"> · {nextMilestone.target_date}</span>
                )}
              </div>
            )}

            {/* Progress display — deadline-bound goals show a % bar
                (there's a real finish line); open-ended goals show a
                qualitative rating chip (no finish, just "how am I
                doing in this area right now"). */}
            {goal.target_date && progressPct != null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, progressPct)}%`,
                      background: progressPct >= 70 ? PALETTE.success : progressPct >= 40 ? PALETTE.warning : PALETTE.dim,
                      transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
                <span className="text-[11px] text-zinc-500 tabular-nums">{progressPct}%</span>
              </div>
            )}
            {!goal.target_date && (() => {
              const tier = computeRating({
                adherencePct,
                ratePerWeek:   stats.ratePerWeek,
                targetValue:   goal.target_value ?? null,
                latest:        stats.latest,
                startingValue: goal.starting_value ?? null,
              });
              if (!tier) {
                return (
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    {goal.goal_type === "quantitative"
                      ? "Log a metric to see how you're tracking."
                      : "Link a routine item to see how you're tracking."}
                  </p>
                );
              }
              const color = ratingColor(tier);
              return (
                <div className="mt-2 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color }}>
                    {tier}
                  </span>
                </div>
              );
            })()}
            {goal.target_date && progressPct == null && (
              <p className="text-[11px] text-zinc-500 mt-1.5">
                {goal.goal_type === "quantitative"
                  ? "Log a metric to see progress."
                  : "Link a routine item to see adherence."}
              </p>
            )}
          </div>
          {isExpanded
            ? <ChevronUp size={16} className="text-zinc-500 mt-0.5 flex-shrink-0" />
            : <ChevronDown size={16} className="text-zinc-500 mt-0.5 flex-shrink-0" />}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4">
          {/* ── Quantitative: metric log + trend ── */}
          {goal.goal_type === "quantitative" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <FormLabel className="mb-0">Metric log</FormLabel>
                {stats.ratePerWeek !== 0 && (
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    {stats.ratePerWeek >= 0 ? "+" : ""}{stats.ratePerWeek.toFixed(2)}/wk
                    {goal.metric_unit ? ` ${goal.metric_unit}` : ""}
                  </span>
                )}
              </div>

              {/* Mini sparkline of last ~20 metric values */}
              {metrics.length >= 2 && (
                <MetricSparkline
                  values={metrics.slice(-20).map((m) => m.value)}
                  targetValue={goal.target_value}
                  startingValue={goal.starting_value}
                />
              )}

              {/* Add a metric */}
              <div className="flex items-center gap-2 mt-2">
                <FormInput
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={metricDraft}
                  onChange={(e) => setMetricDraft(e.target.value)}
                  placeholder={`Log new value${goal.metric_unit ? ` (${goal.metric_unit})` : ""}`}
                  className="flex-1"
                />
                <button
                  onClick={handleLogMetric}
                  disabled={!metricDraft.trim()}
                  className="px-4 py-2.5 rounded-xl bg-white text-zinc-900 text-xs font-bold disabled:opacity-40"
                >
                  Log
                </button>
              </div>

              {/* Last few entries */}
              {metrics.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {metrics.slice(-5).reverse().map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span className="tabular-nums text-zinc-300">{m.value}{goal.metric_unit ? ` ${goal.metric_unit}` : ""}</span>
                      <span className="text-zinc-600">{new Date(m.logged_at).toLocaleDateString()}</span>
                      <button onClick={() => deleteMetric(m.id)} className="text-zinc-700 hover:text-red-400 ml-2">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Milestones (all goal types) ── */}
          <div>
            <FormLabel>Milestones</FormLabel>
            {milestones.length === 0 ? (
              <p className="text-[11px] text-zinc-500 mb-2">No milestones yet. Break this goal into checkpoints.</p>
            ) : (
              <div className="space-y-1.5 mb-2">
                {milestones.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-zinc-900/40">
                    <CompletionToggle
                      done={m.is_complete}
                      onToggle={() => toggleMilestone(m.id)}
                      mode="small"
                      celebrate
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${m.is_complete ? "text-zinc-500 line-through" : "text-zinc-200"}`}>
                        {m.title}
                      </p>
                      {m.target_date && (
                        <p className="text-[10px] text-zinc-600 tabular-nums">{m.target_date}</p>
                      )}
                    </div>
                    <button onClick={() => deleteMilestone(m.id)} className="text-zinc-700 hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new milestone */}
            <div className="flex items-center gap-2">
              <FormInput
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddMilestone(); }}
                placeholder="Add a milestone"
                className="flex-1"
              />
              <FormInput
                type="date"
                value={newMilestoneDate}
                onChange={(e) => setNewMilestoneDate(e.target.value)}
                className="w-36"
              />
              <button
                onClick={handleAddMilestone}
                disabled={!newMilestoneTitle.trim()}
                className="px-3 py-2.5 rounded-xl bg-zinc-100 text-zinc-900 text-xs font-bold disabled:opacity-40"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Current state */}
          <div>
            <FormLabel>Current state</FormLabel>
            <FormTextarea
              value={editingState}
              onChange={(e) => setEditingState(e.target.value)}
              onBlur={() => editingState !== (goal.current_state ?? "") && onUpdate(goal.id, { current_state: editingState })}
              placeholder="Where things stand right now…"
              rows={2}
              className="italic"
            />
          </div>

          {/* Next steps */}
          <div>
            <FormLabel>Next steps</FormLabel>
            <FormTextarea
              value={editingNext}
              onChange={(e) => setEditingNext(e.target.value)}
              onBlur={() => editingNext !== (goal.next_steps ?? "") && onUpdate(goal.id, { next_steps: editingNext })}
              placeholder="What's next…"
              rows={3}
            />
          </div>

          {/* Linked routine items */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FormLabel className="mb-0">Linked routine items</FormLabel>
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
                        {item.taken && <Check size={9} strokeWidth={3} className="text-white" />}
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

          {/* Business metrics — schemaless key/value (kept) */}
          {goal.bucket === "business" && (
            <MetricsEditor
              metrics={goal.metrics ?? {}}
              onSave={(m) => onUpdate(goal.id, { metrics: m })}
            />
          )}

          {/* Jarvis's take */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`${TYPE.label} flex items-center gap-1`}>
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

          {/* My plan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <FormLabel className="mb-0">My plan</FormLabel>
              <button
                onClick={handleSuggestPlan}
                disabled={suggestingPlan}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 disabled:opacity-40"
              >
                <Sparkles size={10} />
                {suggestingPlan ? "Drafting…" : (editingPlan.trim() ? "Replace with Jarvis draft" : "Suggest with Jarvis")}
              </button>
            </div>
            <FormTextarea
              value={editingPlan}
              onChange={(e) => setEditingPlan(e.target.value)}
              onBlur={() => editingPlan !== (goal.ai_action_plan ?? "") && onUpdate(goal.id, { ai_action_plan: editingPlan })}
              placeholder="What specifically you're doing / taking to get there. Substances, training, habits, milestones."
              rows={4}
              className="whitespace-pre-wrap"
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

          {/* Linked chats — external Claude.ai / ChatGPT conversations
              about this goal (research, protocol design, brainstorms) */}
          <div className="pt-4 border-t border-zinc-800">
            <LinkedChats goalId={goal.id} />
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

// ── Quantitative metric sparkline ──
function MetricSparkline({ values, targetValue, startingValue }: { values: number[]; targetValue: number | null; startingValue: number | null }) {
  if (values.length < 2) return null;
  const min = Math.min(...values, ...(targetValue != null ? [targetValue] : []), ...(startingValue != null ? [startingValue] : []));
  const max = Math.max(...values, ...(targetValue != null ? [targetValue] : []), ...(startingValue != null ? [startingValue] : []));
  const range = max - min || 1;
  const w = 100;
  const h = 36;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const targetY = targetValue != null ? h - ((targetValue - min) / range) * h : null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="40" preserveAspectRatio="none" className="mb-1">
      {targetY != null && (
        <line x1={0} y1={targetY} x2={w} y2={targetY} stroke={PALETTE.success} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.6" />
      )}
      <polyline fill="none" stroke="#fafafa" strokeWidth="1.5" points={pts.join(" ")} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Tiny schemaless metrics editor (kept from before, used by business goals)
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
  function addRow() { setRows((prev) => [...prev, { k: "", v: "" }]); }
  async function save() {
    const obj: Record<string, unknown> = {};
    for (const r of rows) {
      if (!r.k.trim()) continue;
      const n = Number(r.v);
      obj[r.k.trim()] = !isNaN(n) && r.v.trim() !== "" ? n : r.v;
    }
    await onSave(obj);
  }

  return (
    <div>
      <FormLabel>Business metrics</FormLabel>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <FormInput value={r.k} onChange={(e) => update(i, "k", e.target.value)} onBlur={save} placeholder="MRR" className="flex-1" />
            <FormInput value={r.v} onChange={(e) => update(i, "v", e.target.value)} onBlur={save} placeholder="$0" className="flex-1" />
          </div>
        ))}
        <button onClick={addRow} className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 py-2 -my-1">
          <Plus size={ICON.xs} /> Add metric
        </button>
      </div>
    </div>
  );
}
