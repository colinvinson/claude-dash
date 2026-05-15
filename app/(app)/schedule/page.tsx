"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useStack, type StackItem } from "@/hooks/useStack";
import { useStackInsights } from "@/hooks/useStackInsights";
import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";
import TimelineSchedule from "@/components/schedule/TimelineSchedule";
import AddScheduleItem from "@/components/schedule/AddScheduleItem";

// Schedule tab: ONLY the schedule. No biometrics, no protein, no goals,
// no journal. Those live on their proper tabs (Home / Gym / Goals).

export default function SchedulePage() {
  const { items, toggle, createItem, updateItem, archiveItem } = useStack();
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StackItem | null>(null);

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

  // The sheet is reused for both add and edit. Whichever path opens it sets
  // its own state — closing always resets editingItem.
  const sheetOpen = addOpen || !!editingItem;
  function closeSheet() {
    setAddOpen(false);
    setEditingItem(null);
  }

  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <SectionLabel>Schedule</SectionLabel>
      </div>

      <div className="anim-fade-up stagger-1">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Today</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-600">{doneCount}/{todayItems.length} done · resets 6 AM</span>
              <button
                onClick={() => { setEditingItem(null); setAddOpen(true); }}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-white text-zinc-900 text-[11px] font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          </div>
          <TimelineSchedule
            items={todayItems}
            insights={insights}
            onToggle={toggle}
            onEdit={(item) => { setAddOpen(false); setEditingItem(item); }}
          />
        </Card>
      </div>

      <AddScheduleItem
        open={sheetOpen}
        onClose={closeSheet}
        onCreate={createItem}
        existingItem={editingItem}
        onUpdate={updateItem}
        onArchive={archiveItem}
      />
    </div>
  );
}
