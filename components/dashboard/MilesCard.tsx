import { ReactNode } from "react";
import SectionHeader from "@/components/ui/SectionHeader";

// MilesCard — the card chrome pattern from the Miles OS dashboard.
// Numbered section header at the top + dark fill + hairline border +
// rounded corners + padded content. One primitive for every Home card.
//
// Use this EVERYWHERE on dashboard surfaces. If a section doesn't fit
// the numbered convention, just omit `number`.

export default function MilesCard({
  number,
  label,
  right,
  accent,
  children,
  className = "",
  paddingClass = "p-4 pt-3",
}: {
  number?: string;
  label:   string;
  right?:  ReactNode;
  accent?: string;
  children: ReactNode;
  className?: string;
  paddingClass?: string;
}) {
  return (
    <div
      className={`rounded-xl ${paddingClass} ${className}`}
      style={{
        background: "rgba(255,255,255,0.02)",
        border:     "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <SectionHeader number={number} label={label} right={right} accent={accent} />
      {children}
    </div>
  );
}
