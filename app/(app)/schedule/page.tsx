"use client";

import { useMemo, useState } from "react";
import { useStack, type StackItem } from "@/hooks/useStack";
import { useStackInsights } from "@/hooks/useStackInsights";
import Card from "@/components/ui/Card";
import { FormInput, FormSelect } from "@/components/ui/FormInput";
import { TYPE } from "@/lib/design-tokens";
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
  // Separate "add new" sheet flag so opening the rich add path doesn't
  // collide with edit-existing logic.
  const [addOpen,     setAddOpen]     = useState(false);

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
            <div className={`${TYPE.label} mb-2`}>Add to stack</div>
            <div className="flex items-center gap-2">
              <FormInput
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Name"
                className="flex-1 min-w-0"
              />
              <FormInput
                value={draftDose}
                onChange={(e) => setDraftDose(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Dose"
                className="w-20"
              />
              <FormSelect
                value={draftTiming}
                onChange={(e) => setDraftTiming(e.target.value)}
                className="w-28"
              >
                {BUCKET_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </FormSelect>
              <button
                onClick={handleAdd}
                disabled={adding || draftName.trim().length === 0}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-zinc-900 disabled:opacity-40 whitespace-nowrap"
              >
                {adding ? "…" : "+ Add"}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-zinc-600">Tap an item above for full edit.</p>
              <button
                onClick={() => setAddOpen(true)}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
              >
                More options →
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Edit existing — opens when a row is tapped. */}
      <AddScheduleItem
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onCreate={createItem}
        existingItem={editingItem}
        onUpdate={updateItem}
        onArchive={archiveItem}
      />

      {/* Rich add — same sheet, no existingItem. Reaches the full option set
          (icon, scheduled_at, duration, recurrence, link to goal, category). */}
      <AddScheduleItem
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={createItem}
        existingItem={null}
        onUpdate={updateItem}
        onArchive={archiveItem}
      />
    </div>
  );
}
