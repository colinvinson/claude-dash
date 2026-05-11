"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Smoothly ticks a numeric value from its previous value to the new target.
 * Uses requestAnimationFrame with ease-out cubic.
 */
export function useAnimatedNumber(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const fromRef  = useRef(target);
  const rafRef   = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to   = target;
    if (from === to) return;

    const start = performance.now();
    function tick(now: number) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(from + (to - from) * eased);
      setDisplay(next);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}
