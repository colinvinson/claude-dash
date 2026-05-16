"use client";

import { useState } from "react";
import { Plus, Sparkles, ChevronRight, X } from "lucide-react";
import Card from "@/components/ui/Card";
import { useStack } from "@/hooks/useStack";
import type { GoalBucket, LongTermGoal } from "@/hooks/useLongTermGoals";

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
    title: string;
    bucket: GoalBucket;
    category?: string;
    target_date?: string;
  }) => Promise<LongTermGoal | null>;
  onUpdate: (id: string, patch: Partial<LongTermGoal>) => Promise<void>;
};

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
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [draft, setDraft] = useState<ProtocolDraft | null>(null);
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});
  const [editingPlan, setEditingPlan] = useState("");

  function reset() {
    setPhase("fork"); setTitle(""); setCategory(""); setDate("");
    setDraft(null); setAccepted({}); setEditingPlan(""); setError(null);
  }

  async function handleManualSave() {
    if (!title.trim()) return;
    setBusy(true);
    await onCreate({ title, bucket, category: category.trim() || undefined, target_date: date || undefined });
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
    const goal = await onCreate({ title, bucket, category: category.trim() || undefined, target_date: date || undefined });
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
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">{headerLabel}</span>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={bucket === "business" ? "e.g. Ship SaaS v1" : "e.g. Boost testosterone"}
              className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Tag (optional)</span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={bucket === "business" ? "SaaS" : "Hormones / Tan / …"}
                className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
              />
            </label>
            <div className="w-44">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Target date</span>
                {date && (
                  <button onClick={() => setDate("")} className="text-[10px] text-zinc-500 hover:text-zinc-300">Clear</button>
                )}
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
              />
            </div>
          </div>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          {/* Path fork */}
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
              className="py-2.5 rounded-xl bg-amber-300 text-zinc-900 hover:opacity-90 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Sparkles size={13} /> Help me build one
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 text-center">
            &ldquo;Help me build one&rdquo; → Jarvis drafts a plan + suggested supplements / habits ranked by effect size. Sir reviews before anything saves.
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
          Jarvis is drafting Sir&apos;s protocol…
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
          <span className="text-[10px] uppercase tracking-widest text-amber-300 font-bold flex items-center gap-1">
            <Sparkles size={11} /> Jarvis&apos;s protocol for &ldquo;{title}&rdquo;
          </span>
          <button onClick={reset} className="text-zinc-500 hover:text-zinc-200" aria-label="Cancel"><X size={14} /></button>
        </div>

        {/* Plan — editable */}
        <div className="mb-4">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">The plan</span>
          <textarea
            value={editingPlan}
            onChange={(e) => setEditingPlan(e.target.value)}
            rows={5}
            className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700 resize-y"
          />
        </div>

        {/* Suggested stack items */}
        {draft.suggested_items.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Add to schedule</span>
              <span className="text-[10px] text-zinc-600">{acceptedCount} of {draft.suggested_items.length} selected</span>
            </div>
            <div className="space-y-1.5">
              {draft.suggested_items.map((s, i) => {
                const on = accepted[i];
                return (
                  <button
                    key={i}
                    onClick={() => setAccepted((a) => ({ ...a, [i]: !a[i] }))}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                      on ? "border-amber-500/40 bg-amber-500/5"
                         : "border-zinc-800 bg-zinc-900/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-zinc-100 truncate">{s.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {s.dose && <span className="text-[10px] text-zinc-500 tabular-nums">{s.dose}</span>}
                        {s.timing && <span className="text-[10px] text-zinc-600">· {s.timing}</span>}
                        <span className={`text-[9px] uppercase tracking-wider font-bold ${on ? "text-amber-300" : "text-zinc-600"}`}>
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
            className="flex-1 py-2.5 rounded-xl bg-amber-300 text-zinc-900 hover:opacity-90 text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {busy ? "Saving…" : <>Save goal + {acceptedCount} {acceptedCount === 1 ? "item" : "items"} <ChevronRight size={13} /></>}
          </button>
        </div>
      </Card>
    );
  }

  return null;
}
