"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { TYPE, ICON } from "@/lib/design-tokens";

// Reusable show/hide section. Smooth animated height via the CSS Grid
// template-rows 0fr ↔ 1fr trick (Chrome 115+, Safari 17.4+, Firefox 115+).
// The grid track interpolates, so children get a real smooth reveal —
// no manual height measurement, no library.
//
// Used in BusinessDetail for Stats / Notes. Header stays visible;
// chevron rotates 180° when open.

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
        <ChevronDown
          size={ICON.xs}
          className="text-zinc-500 transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="pt-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
