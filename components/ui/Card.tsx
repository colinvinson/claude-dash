import { ReactNode, CSSProperties } from "react";

const glassStyle: CSSProperties = {
  background:       "rgba(255, 255, 255, 0.04)",
  backdropFilter:   "blur(24px) saturate(1.2)",
  WebkitBackdropFilter: "blur(24px) saturate(1.2)",
  boxShadow:        "0 12px 40px rgba(0,0,0,0.45)",
  border:           "1px solid rgba(255,255,255,0.06)",
  borderRadius:     "16px",
  padding:          "18px",
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
    <div className={className} style={{ ...glassStyle, ...style }}>
      {children}
    </div>
  );
}
