import { ReactNode, CSSProperties } from "react";
import { RADIUS, SPACING, BORDER, SHADOW } from "@/lib/design-tokens";

// Glass card — the single container primitive. Every Home / tab card
// composes from this. Three variants drive visual hierarchy:
//
//   hero    — THE moment-defining card on a surface. Stronger backdrop
//             blur, denser bg, lit edge highlight at the top (the Apple
//             "lit-from-above" look), deeper shadow. Use exactly once
//             per surface (TodayWrap on Home, BusinessHero on Biz tab).
//   primary — everyday glass card. Default.
//   inline  — minimal border-only "card" for items nested inside another
//             lifted surface (avoids stacking shadows / blurs).
//
// Padding + radius pull from tokens so the visual rhythm stays consistent.

type Variant = "hero" | "primary" | "inline";

const STYLES: Record<Variant, CSSProperties> = {
  hero: {
    background:           "rgba(255, 255, 255, 0.055)",
    backdropFilter:       "blur(32px) saturate(1.4)",
    WebkitBackdropFilter: "blur(32px) saturate(1.4)",
    boxShadow:            SHADOW.hero,
    border:               `1px solid ${BORDER.hair}`,
    borderRadius:         `${RADIUS.lg}px`,
    padding:              `${SPACING.lg}px`,
  },
  primary: {
    background:           "rgba(255, 255, 255, 0.04)",
    backdropFilter:       "blur(24px) saturate(1.2)",
    WebkitBackdropFilter: "blur(24px) saturate(1.2)",
    boxShadow:            SHADOW.primary,
    border:               `1px solid ${BORDER.hair}`,
    borderRadius:         `${RADIUS.lg}px`,
    padding:              `${SPACING.lg}px`,
  },
  inline: {
    background:    "transparent",
    boxShadow:     SHADOW.inline,
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
