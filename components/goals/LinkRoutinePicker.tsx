"use client";

import { X } from "lucide-react";
import { useStack } from "@/hooks/useStack";
import { ICON } from "@/lib/design-tokens";

// Sheet that lists every active stack item NOT already linked to a goal.
// Tapping a row links it to the goal, closes the sheet.

export default function LinkRoutinePicker({
  goalId,
  open,
  onClose,
  onLink,
}: {
  goalId: string;
  open: boolean;
  onClose: () => void;
  onLink: (itemId: string, goalId: string) => Promise<void>;
}) {
  const { items } = useStack();
  if (!open) return null;

  const candidates = items.filter((i) => i.linked_goal_id !== goalId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto anim-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-100">Link a routine item</h2>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2"><X size={ICON.md} /></button>
        </div>
        {candidates.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4">No unlinked routine items. Add some from the Schedule tab.</p>
        ) : (
          <div className="space-y-1">
            {candidates.map((item) => (
              <button
                key={item.id}
                onClick={async () => { await onLink(item.id, goalId); onClose(); }}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-zinc-100 truncate block">{item.name}</span>
                  {item.dose && <span className="text-[11px] text-zinc-500 block">{item.dose}</span>}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 ml-3">{item.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
