"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

// Small celebratory dot-burst. Renders absolutely inside its parent — wrap a
// completion target in `relative` and place this inside. Re-triggered by
// changing the `trigger` prop (any value change fires once).

const COLORS = ["#34d399", "#fbbf24", "#60a5fa", "#f472b6", "#a78bfa", "#fb7185"];

type Piece = { id: number; x: number; y: number; r: number; c: string; size: number };

export default function ConfettiBurst({
  trigger,
  count = 18,
  spread = 90,
}: {
  trigger: number;
  count?: number;
  spread?: number;
}) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const next: Piece[] = Array.from({ length: count }, (_, i) => {
      // Polar coordinates for an even-ish burst pattern.
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist  = spread * (0.6 + Math.random() * 0.6);
      return {
        id: trigger * 1000 + i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 20,
        r: Math.random() * 540 - 270,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 3 + Math.floor(Math.random() * 3),
      };
    });
    setPieces(next);
    const t = setTimeout(() => setPieces([]), 1000);
    return () => clearTimeout(t);
  }, [trigger, count, spread]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute rounded-sm"
          style={{
            width:  p.size,
            height: p.size,
            background: p.c,
            ["--tx" as string]:  `${p.x}px`,
            ["--ty" as string]:  `${p.y}px`,
            ["--rot" as string]: `${p.r}deg`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
