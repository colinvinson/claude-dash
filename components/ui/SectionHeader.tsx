import { ReactNode } from "react";
import { TYPE } from "@/lib/design-tokens";

// SectionHeader — the "01 // OPERATOR" pattern from Miles OS.
//
// Numbered section anchor (optional) + uppercase label + optional right-aligned
// metadata. Pairs with the flat Card primitive: SectionHeader sits at the top
// of each section, the spacing below it does all the visual work.
//
// Usage:
//   <SectionHeader number="01" label="OPERATOR" right="ONLINE" />
//   <SectionHeader label="NET WORTH" right={<span>LIVE</span>} />
//
// Number prefix is optional — pages can use plain labels too. Keep numbers
// stable per surface (Home's Operator is always 01, Finance Pulse is always
// 07 in the screenshots) so users learn position.

export default function SectionHeader({
  number,
  label,
  right,
  accent,
}: {
  number?: string;        // "01", "02", etc — optional
  label:   string;        // "OPERATOR" / "NET WORTH" / etc.
  right?:  ReactNode;     // right-aligned metadata (LIVE, count, badge, etc.)
  accent?: string;        // optional accent color for the left dash
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className={`flex items-center gap-2 ${TYPE.section}`}>
        <span
          aria-hidden
          className="inline-block"
          style={{
            width:  10,
            height: 1,
            background: accent ?? "rgba(255,255,255,0.25)",
          }}
        />
        {number && (
          <span className="text-zinc-600">{number} //</span>
        )}
        <span>{label}</span>
      </div>
      {right && (
        <div className={`${TYPE.section} text-zinc-500`}>
          {right}
        </div>
      )}
    </div>
  );
}
