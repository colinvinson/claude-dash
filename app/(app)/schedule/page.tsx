"use client";

import { useMemo, useState } from "react";
import { useStack, type StackItem } from "@/hooks/useStack";
import { useStackInsights } from "@/hooks/useStackInsights";
import Card from "@/components/ui/Card";
import TimelineSchedule from "@/components/schedule/TimelineSchedule";
import AddScheduleItem from "@/components/schedule/AddScheduleItem";

// Schedule tab: ONLY the schedule. No biometrics, no protein, no goals.
//
// Visual model:
//   - Top: header + progress bar (X / Y taken today · resets at 6 AM)
//   - Middle: TimelineSchedule grouped by Morning / Day / Night / Anytime
//   - Bottom: inline "add to stack" form (name + dose + bucket + Add).
//     Tapping an existing row still opens the rich edit sheet.

const BUCKET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "anytime", label: "Anytime" },
  { value: "morning", label: "Morning" },
  { value: "day",     label: "Day"     },
  { value: "night",   label: "Night"   },
];

export default function SchedulePage() {
  const {
    items, toggle, createItem, updateItem, archiveItem, toggleRunningLow,
  } = useStack();
  const [editingItem, setEditingItem] = useState<StackItem | null>(null);

  // Inline add form state.
  const [draftName, setDraftName] = useState("");
  const [draftDose, setDraftDose] = useState("");
  const [draftTiming, setDraftTiming] = useState("anytime");
  const [adding, setAdding] = useState(false);

  // Filter to today's day-of-week (recurrence support).
  const todayDow = new Date().getDay();
  const todayItems = useMemo(() => {
    return items.filter((i) => {
      if (!i.days_of_week || i.days_of_week.length === 0 || i.days_of_week.length === 7) return true;
      return i.days_of_week.includes(todayDow);
    });
  }, [items, todayDow]);

  const { insights } = useStackInsights(items);
  const doneCount = todayItems.filter((i) => i.taken).length;
  const totalCount = todayItems.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  async function handleAdd() {
    const name = draftName.trim();
    if (!name) return;
    setAdding(true);
    await createItem({
      name,
      dose: draftDose.trim() || undefined,
      timing: draftTiming,
    });
    setDraftName("");
    setDraftDose("");
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <Card>
          <div className="mb-2">
            <h2 className="text-2xl font-bold text-zinc-50">Tap each as you take it</h2>
            <p className="text-xs text-zinc-500 mt-1">
              {doneCount} / {totalCount} taken today · resets at 6 AM
            </p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-zinc-800/60 mb-4">
            <div
              className="h-full rounded-full bg-zinc-100"
              style={{ width: `${pct}%`, transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
          </div>

          <TimelineSchedule
            items={todayItems}
            insights={insights}
            onToggle={toggle}
            onEdit={(item) => setEditingItem(item)}
            onToggleRunningLow={toggleRunningLow}
            onArchive={archiveItem}
          />

          {/* Inline add */}
          <div className="mt-5 pt-4 border-t border-zinc-800/60">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Add to stack</div>
            <div className="flex items-center gap-2">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Name"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
              />
              <input
                value={draftDose}
                onChange={(e) => setDraftDose(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Dose"
                className="w-20 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
              />
              <select
                value={draftTiming}
                onChange={(e) => setDraftTiming(e.target.value)}
                className="px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              >
                {BUCKET_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
              <button
                onClick={handleAdd}
                disabled={adding || draftName.trim().length === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-100 text-zinc-900 disabled:opacity-40 whitespace-nowrap"
              >
                {adding ? "…" : "+ Add"}
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-2">Tap an item above for full edit (icon, schedule, link to goal).</p>
          </div>
        </Card>
      </div>

      <AddScheduleItem
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onCreate={createItem}
        existingItem={editingItem}
        onUpdate={updateItem}
        onArchive={archiveItem}
      />
    </div>
  );
}
