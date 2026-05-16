import { ReactNode, CSSProperties } from "react";
import { RADIUS, SPACING, BORDER } from "@/lib/design-tokens";

// Glass card — the single container primitive. Every Home / tab card
// composes from this. Padding + radius come from tokens so the visual
// rhythm stays consistent across the app.

const baseStyle: CSSProperties = {
  background:           "rgba(255, 255, 255, 0.04)",
  backdropFilter:       "blur(24px) saturate(1.2)",
  WebkitBackdropFilter: "blur(24px) saturate(1.2)",
  boxShadow:            "0 12px 40px rgba(0, 0, 0, 0.45)",
  border:               `1px solid ${BORDER.hair}`,
  borderRadius:         `${RADIUS.lg}px`,
  padding:              `${SPACING.lg}px`,
};

export default function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className} style={{ ...baseStyle, ...style }}>
      {children}
    </div>
  );
}
