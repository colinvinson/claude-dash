"use client";

import { useState } from "react";
import { Plus, Sparkles, ChevronRight, X } from "lucide-react";
import Card from "@/components/ui/Card";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import { useStack } from "@/hooks/useStack";
import type { GoalBucket, LongTermGoal, GoalType } from "@/hooks/useLongTermGoals";
import { PALETTE, TINT, BORDER, TYPE, ICON } from "@/lib/design-tokens";

type Suggestion = {
  name: string;
  dose?: string;
  notes?: string;
  timing?: string;
  category: "supplement" | "medication" | "injection" | "skincare" | "habit" | "exercise" | "meal";
  why: string;
};

type ProtocolDraft = {
  plan: string;
  suggested_items: Suggestion[];
};

type Phase = "fork" | "manual" | "research-loading" | "research-review";

type Props = {
  bucket: GoalBucket;
  onCreate: (args: {
    title:           string;
    bucket:          GoalBucket;
    category?:       string;
    target_date?:    string;
    goal_type?:      GoalType;
    target_value?:   number | null;
    starting_value?: number | null;
    metric_unit?:    string | null;
  }) => Promise<LongTermGoal | null>;
  onUpdate: (id: string, patch: Partial<LongTermGoal>) => Promise<void>;
};

const GOAL_TYPES: Array<{ id: GoalType; label: string; desc: string }> = [
  { id: "project",      label: "Project",      desc: "Ship a thing, build a thing. Tracked by milestones." },
  { id: "quantitative", label: "Quantitative", desc: "A number to hit. T level, body fat %, MRR, etc." },
  { id: "behavioral",   label: "Behavioral",   desc: "Stay consistent at a routine. Tracked by adherence." },
  { id: "aesthetic",    label: "Aesthetic",    desc: "Look a way by a date. Tracked by milestones + photos." },
];

// Add-a-goal sheet with a two-path onboarding fork.
//   "I know my protocol" → standard fields, save immediately.
//   "Help me build one"   → Jarvis researches, drafts a plan + suggested
//                          habits/supplements. Sir reviews, accepts items
//                          (which create supplement_stack rows linked to
//                          the new goal), and the plan saves to
//                          ai_action_plan.
export default function AddGoalFlow({ bucket, onCreate, onUpdate }: Props) {
  const { createItem } = useStack();

  const [phase, setPhase]       = useState<Phase>("fork");
  const [title, setTitle]       = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate]         = useState("");
  const [goalType, setGoalType] = useState<GoalType>("project");
  const [targetValue,   setTargetValue]   = useState("");
  const [startingValue, setStartingValue] = useState("");
  const [metricUnit,    setMetricUnit]    = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [draft, setDraft] = useState<ProtocolDraft | null>(null);
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});
  const [editingPlan, setEditingPlan] = useState("");

  function reset() {
    setPhase("fork"); setTitle(""); setCategory(""); setDate("");
    setGoalType("project"); setTargetValue(""); setStartingValue(""); setMetricUnit("");
    setDraft(null); setAccepted({}); setEditingPlan(""); setError(null);
  }

  // Build the create args including type-specific fields when relevant.
  function buildCreateArgs() {
    return {
      title,
      bucket,
      category:       category.trim() || undefined,
      target_date:    date || undefined,
      goal_type:      goalType,
      target_value:   goalType === "quantitative" && targetValue   ? parseFloat(targetValue)   : null,
      starting_value: goalType === "quantitative" && startingValue ? parseFloat(startingValue) : null,
      metric_unit:    goalType === "quantitative" ? metricUnit.trim() || null : null,
    };
  }

  async function handleManualSave() {
    if (!title.trim()) return;
    setBusy(true);
    await onCreate(buildCreateArgs());
    setBusy(false);
    reset();
  }

  async function handleResearch() {
    if (!title.trim()) return;
    setBusy(true);
    setPhase("research-loading");
    setError(null);
    try {
      const res = await fetch("/api/jarvis/goal-protocol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category: category.trim() || undefined, bucket }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Jarvis couldn't draft the protocol. Try again or build it manually.");
        setPhase("fork");
        return;
      }
      const d = (await res.json()) as ProtocolDraft;
      setDraft(d);
      setEditingPlan(d.plan);
      // Default-accept everything; Sir un-toggles what he doesn't want.
      const initAcc: Record<number, boolean> = {};
      d.suggested_items.forEach((_, i) => { initAcc[i] = true; });
      setAccepted(initAcc);
      setPhase("research-review");
    } catch {
      setError("Network error. Try again.");
      setPhase("fork");
    } finally {
      setBusy(false);
    }
  }

  async function handleResearchSave() {
    setBusy(true);
    const goal = await onCreate(buildCreateArgs());
    if (!goal) { setBusy(false); return; }

    // Save the plan + create accepted stack items linked to the new goal.
    if (editingPlan.trim()) {
      await onUpdate(goal.id, { ai_action_plan: editingPlan.trim() });
    }
    const toAdd = (draft?.suggested_items ?? []).filter((_, i) => accepted[i]);
    for (const s of toAdd) {
      await createItem({
        name:           s.name,
        dose:           s.dose,
        notes:          s.notes,
        timing:         s.timing,
        category:       s.category,
        linked_goal_id: goal.id,
      });
    }
    setBusy(false);
    reset();
  }

  // ── Render ──
  const headerLabel = bucket === "business" ? "Add a business / project" : "Add a life goal";

  // FORK + MANUAL share the title/tag/date inputs; the only difference is
  // which action button is shown.
  if (phase === "fork" || phase === "manual") {
    return (
      <Card>
        <span className={`${TYPE.label} block mb-3`}>{headerLabel}</span>
        <div className="space-y-3">
          <div>
            <FormLabel>Title</FormLabel>
            <FormInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={bucket === "business" ? "e.g. Ship SaaS v1" : "e.g. Boost testosterone"}
            />
          </div>

          {/* Goal type — drives how progress is computed + which fields show */}
          <div>
            <FormLabel>Type</FormLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {GOAL_TYPES.map((t) => {
                const on = goalType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setGoalType(t.id)}
                    className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                      on ? "border-zinc-500 bg-zinc-800/80"
                         : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-zinc-100">{t.label}</div>
                    <div className="text-[10px] text-zinc-500 leading-snug">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantitative-only fields */}
          {goalType === "quantitative" && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <FormLabel optional>Starting</FormLabel>
                <FormInput
                  type="number" inputMode="decimal" step="0.01"
                  value={startingValue}
                  onChange={(e) => setStartingValue(e.target.value)}
                  placeholder="540"
                />
              </div>
              <div>
                <FormLabel>Target</FormLabel>
                <FormInput
                  type="number" inputMode="decimal" step="0.01"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="800"
                />
              </div>
              <div>
                <FormLabel optional>Unit</FormLabel>
                <FormInput
                  value={metricUnit}
                  onChange={(e) => setMetricUnit(e.target.value)}
                  placeholder="ng/dL"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1">
              <FormLabel optional>Tag</FormLabel>
              <FormInput
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={bucket === "business" ? "SaaS" : "Hormones / Tan / …"}
              />
            </div>
            <div className="w-44">
              <div className="flex items-center justify-between mb-1">
                <FormLabel className="mb-0">Target date</FormLabel>
                {date && (
                  <button onClick={() => setDate("")} className="text-[10px] text-zinc-500 hover:text-zinc-300 -m-2 p-2">Clear</button>
                )}
              </div>
              <FormInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-[11px]" style={{ color: PALETTE.danger }}>{error}</p>}

          {/* Path fork — both buttons match the global primary/secondary
              language (white = primary, bordered = secondary). No more
              amber-as-primary that meant something different elsewhere. */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleManualSave}
              disabled={busy || !title.trim()}
              className="py-2.5 rounded-xl border border-zinc-700 text-zinc-200 hover:bg-zinc-800 text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Plus size={13} /> {busy ? "…" : "I know my protocol"}
            </button>
            <button
              onClick={handleResearch}
              disabled={busy || !title.trim()}
              className="py-2.5 rounded-xl bg-white text-zinc-900 hover:opacity-90 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Sparkles size={13} /> Help me build one
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 text-center">
            &ldquo;Help me build one&rdquo; → Jarvis drafts a plan + suggested supplements / habits ranked by effect size. You review before anything saves.
          </p>
        </div>
      </Card>
    );
  }

  if (phase === "research-loading") {
    return (
      <Card>
        <div className="flex items-center justify-center gap-2 py-6 text-zinc-400 text-sm">
          <Sparkles size={14} className="animate-pulse" />
          Jarvis is drafting your protocol…
        </div>
        <p className="text-[10px] text-zinc-600 text-center mt-1">Goal: {title}</p>
      </Card>
    );
  }

  // RESEARCH REVIEW — show drafted plan + suggested items with toggle pills.
  if (phase === "research-review" && draft) {
    const acceptedCount = Object.values(accepted).filter(Boolean).length;
    return (
      <Card>
        <div className="flex items-center justify-between mb-3">
          <span className={`${TYPE.label} font-bold flex items-center gap-1`} style={{ color: PALETTE.celebration }}>
            <Sparkles size={11} /> Jarvis&apos;s protocol for &ldquo;{title}&rdquo;
          </span>
          <button onClick={reset} className="text-zinc-500 hover:text-zinc-200 -m-2 p-2" aria-label="Cancel"><X size={ICON.sm} /></button>
        </div>

        {/* Plan — editable */}
        <div className="mb-4">
          <FormLabel>The plan</FormLabel>
          <FormTextarea
            value={editingPlan}
            onChange={(e) => setEditingPlan(e.target.value)}
            rows={5}
          />
        </div>

        {/* Suggested stack items */}
        {draft.suggested_items.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <FormLabel className="mb-0">Add to schedule</FormLabel>
              <span className="text-[10px] text-zinc-600">{acceptedCount} of {draft.suggested_items.length} selected</span>
            </div>
            <div className="space-y-1.5">
              {draft.suggested_items.map((s, i) => {
                const on = accepted[i];
                return (
                  <button
                    key={i}
                    onClick={() => setAccepted((a) => ({ ...a, [i]: !a[i] }))}
                    className="w-full text-left px-3 py-2.5 rounded-lg border transition-all"
                    style={on
                      ? { borderColor: BORDER.celebration, background: TINT.celebration }
                      : { borderColor: "rgb(39 39 42)", background: "rgba(24,24,27,0.5)", opacity: 0.6 }
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-zinc-100 truncate">{s.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {s.dose && <span className="text-[10px] text-zinc-500 tabular-nums">{s.dose}</span>}
                        {s.timing && <span className="text-[10px] text-zinc-600">· {s.timing}</span>}
                        <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: on ? PALETTE.celebration : "rgb(82 82 91)" }}>
                          {on ? "added" : "skip"}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">{s.why}</p>
                    {s.notes && <p className="text-[10px] text-zinc-600 mt-0.5">{s.notes}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-semibold disabled:opacity-40"
          >
            Back
          </button>
          <button
            onClick={handleResearchSave}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-white text-zinc-900 hover:opacity-90 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {busy ? "Saving…" : <>Save goal + {acceptedCount} {acceptedCount === 1 ? "item" : "items"} <ChevronRight size={13} /></>}
          </button>
        </div>
      </Card>
    );
  }

  return null;
}
