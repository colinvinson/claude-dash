import { ReactNode, CSSProperties } from "react";
import { SPACING } from "@/lib/design-tokens";

// Card — semantic section wrapper. No background, no border, no shadow,
// no radius. Just padding so internal content has breathing room.
// Sections on the page are defined by headers + spacing, not chrome.
//
// Variants kept only to honor existing import sites; they all render
// the same flat block. Variant prop is a no-op visually but tuning a
// single variant later (if a real "lifted" treatment comes back) won't
// require touching every consumer.

type Variant = "hero" | "primary" | "inline";

const STYLES: Record<Variant, CSSProperties> = {
  hero:    { padding: `${SPACING.lg}px 0` },
  primary: { padding: `${SPACING.lg}px 0` },
  inline:  { padding: `${SPACING.md}px 0` },
};

export default function Card({
  children,
  className = "",
  style,
  variant = "primary",
}: {
  children:   ReactNode;
  className?: string;
  style?:     CSSProperties;
  variant?:   Variant;
}) {
  return (
    <div className={className} style={{ ...STYLES[variant], ...style }}>
      {children}
    </div>
  );
}
