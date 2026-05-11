"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { haptic } from "@/lib/haptic";

const TRIGGER_THRESHOLD = 70;
const MAX_PULL          = 130;
const SPRING_DURATION   = 240;

type Props = { children: ReactNode };

export default function PullToRefresh({ children }: Props) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const startY      = useRef<number | null>(null);
  const [pull, setPull]         = useState(0);   // current visual offset
  const [refreshing, setRefreshing] = useState(false);
  const [animating, setAnimating]   = useState(false);
  const triggered                   = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (!el) return;
      if (el.scrollTop > 0 || refreshing) return;
      startY.current = e.touches[0].clientY;
      triggered.current = false;
      setAnimating(false);
    }

    function onTouchMove(e: TouchEvent) {
      if (!el) return;
      if (startY.current == null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0 || el.scrollTop > 0) {
        startY.current = null;
        setPull(0);
        return;
      }
      // Rubber-band: full pull rate up to threshold, then resistance
      const eased = delta < TRIGGER_THRESHOLD
        ? delta
        : TRIGGER_THRESHOLD + (delta - TRIGGER_THRESHOLD) * 0.4;
      const clamped = Math.min(MAX_PULL, eased);
      setPull(clamped);

      if (clamped >= TRIGGER_THRESHOLD && !triggered.current) {
        triggered.current = true;
        haptic("light");
      }
    }

    async function onTouchEnd() {
      if (startY.current == null) return;
      const willRefresh = pull >= TRIGGER_THRESHOLD;
      startY.current = null;
      setAnimating(true);

      if (willRefresh) {
        setRefreshing(true);
        setPull(60); // hold at refreshing position
        haptic("success");
        try {
          router.refresh();
          // Give the refresh a moment to take effect; it's a fire-and-forget
          await new Promise((r) => setTimeout(r, 600));
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: true });
    el.addEventListener("touchend",   onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, refreshing, router]);

  const progress = Math.min(1, pull / TRIGGER_THRESHOLD);
  const rotation = progress * 270;

  return (
    <div
      ref={scrollerRef}
      className="flex-1 overflow-y-auto relative"
      style={{
        transform: `translateY(${pull * 0.4}px)`,
        transition: animating ? `transform ${SPRING_DURATION}ms cubic-bezier(0.22,1,0.36,1)` : "none",
      }}
    >
      {/* Refresh indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
        style={{
          top: -44,
          height: 44,
          opacity: progress,
        }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            transform: refreshing ? "none" : `rotate(${rotation}deg)`,
            transition: refreshing ? "none" : "transform 80ms linear",
          }}
        >
          <RefreshCw size={14} className={`text-zinc-200 ${refreshing ? "animate-spin" : ""}`} />
        </div>
      </div>

      {children}
    </div>
  );
}
