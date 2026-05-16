"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TYPE, ICON } from "@/lib/design-tokens";

// Reusable show/hide section. Header stays visible (label + count chip
// optional + chevron); body collapses to zero height. Used in
// BusinessDetail for stats / notes which are valuable to have around
// but shouldn't dominate the page.

export default function CollapsibleSection({
  label,
  count,
  defaultOpen = false,
  children,
}: {
  label:        string;
  count?:       number;
  defaultOpen?: boolean;
  children:     ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-1 -mx-2 px-2 rounded-lg hover:bg-zinc-900/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={TYPE.label}>{label}</span>
          {typeof count === "number" && count > 0 && (
            <span className="text-[10px] text-zinc-600 tabular-nums">{count}</span>
          )}
        </div>
        {open
          ? <ChevronUp   size={ICON.xs} className="text-zinc-500" />
          : <ChevronDown size={ICON.xs} className="text-zinc-500" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
