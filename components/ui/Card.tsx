import { ReactNode, CSSProperties } from "react";
import { RADIUS, SPACING, BORDER } from "@/lib/design-tokens";

// Card — the container primitive. Two real treatments:
//
//   FLAT (default — hero / primary / inline):
//     Just padding. No background, no border, no radius. Content sits
//     on the canvas; sections are defined by headers + spacing. Use for
//     dashboard surfaces (Home cards, Finance sections, etc.).
//
//   ITEM (variant="item"):
//     Real card chrome — hairline border, subtle fill, rounded corners.
//     Use for list items (businesses, goals, anything that's "one of
//     many things you can tap to drill into").
//
// Variant names hero/primary/inline kept as no-op aliases so existing
// import sites still compile. They all render flat.

type Variant = "hero" | "primary" | "inline" | "item";

const STYLES: Record<Variant, CSSProperties> = {
  hero:    { padding: `${SPACING.lg}px 0` },
  primary: { padding: `${SPACING.lg}px 0` },
  inline:  { padding: `${SPACING.md}px 0` },
  item: {
    background:    "rgba(255, 255, 255, 0.025)",
    border:        `1px solid ${BORDER.hair}`,
    borderRadius:  `${RADIUS.lg}px`,
    padding:       `${SPACING.lg}px`,
  },
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
