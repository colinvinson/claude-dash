import { ReactNode, CSSProperties } from "react";
import { RADIUS, SPACING, BORDER } from "@/lib/design-tokens";

// Card — the single container primitive. Every Home / tab card composes
// from this. The "dark and sleek" direction: content sits on the canvas,
// defined by a hairline border + padding, NOT by elevated glass fills
// or shadows. Variants:
//
//   hero    — THE moment-defining surface. Same flat treatment as primary
//             but with the larger lg radius + slightly brighter border so
//             it still reads as the focal element on its surface.
//   primary — everyday card. Flat. Hairline border on near-canvas fill.
//   inline  — nested rows / sub-blocks. Smaller radius, no fill at all.
//
// Padding + radius pull from tokens so the visual rhythm stays consistent.

type Variant = "hero" | "primary" | "inline";

const STYLES: Record<Variant, CSSProperties> = {
  hero: {
    background:    "rgba(255, 255, 255, 0.015)",
    border:        "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius:  `${RADIUS.lg}px`,
    padding:       `${SPACING.lg}px`,
  },
  primary: {
    background:    "rgba(255, 255, 255, 0.015)",
    border:        `1px solid ${BORDER.hair}`,
    borderRadius:  `${RADIUS.lg}px`,
    padding:       `${SPACING.lg}px`,
  },
  inline: {
    background:    "transparent",
    border:        `1px solid ${BORDER.hair}`,
    borderRadius:  `${RADIUS.md}px`,
    padding:       `${SPACING.md}px`,
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
