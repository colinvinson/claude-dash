"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_TABS } from "@/lib/nav";
import JarvisHUD from "@/app/(app)/jarvis/JarvisHUD";

// Floating-island sidebar. Per the geometry correction:
//
//   Positioning:           fixed, left=16, top=64, bottom=64
//   Width:                 72px
//   Height:                calc(100vh - 128px) (implicit via top+bottom)
//   Border radius:         20px on all corners (capsule)
//   Background:            rgba(13, 11, 20, 0.70) + backdrop-filter blur(24px)
//   Border:                1px solid rgba(255, 255, 255, 0.08)
//   Box shadow:            0 12px 32px 4px rgba(0,0,0,0.5),
//                          0 4px 12px 0 rgba(0,0,0,0.3)
//
// Content layer runs full-width UNDERNEATH this floating capsule — no
// left-padding offset. The max-w-2xl centered content has its own
// margins, so on typical desktop widths the sidebar floats over empty
// whitespace, not over content.
//
// Item geometry stays per the earlier pixel spec:
//   48×48 box, 12px radius, 22px icons, 16px gaps, 64px top padding
//   to first item (Jarvis orb fits inside that zone).

export const SIDE_NAV_W = 72;

const TOP_PAD       = 64;
const ITEM_BOX      = 48;
const ITEM_GAP      = 16;
const ITEM_STRIDE   = ITEM_BOX + ITEM_GAP;
const PILL_HEIGHT   = 24;
const PILL_OFFSET_Y = TOP_PAD + (ITEM_BOX - PILL_HEIGHT) / 2;

export default function SideNav() {
  const pathname = usePathname();
  const [jarvisOpen, setJarvisOpen]       = useState(false);
  const [jarvisPrefill, setJarvisPrefill] = useState<string | undefined>(undefined);

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      setJarvisPrefill(detail?.prompt);
      setJarvisOpen(true);
    }
    window.addEventListener("jarvis:open", onOpen as EventListener);
    return () => window.removeEventListener("jarvis:open", onOpen as EventListener);
  }, []);

  const activeIndex = NAV_TABS.findIndex(
    (t) => pathname === t.href || pathname.startsWith(t.href + "/"),
  );

  return (
    <>
      {jarvisOpen && (
        <JarvisHUD
          onClose={() => { setJarvisOpen(false); setJarvisPrefill(undefined); }}
          initialMessage={jarvisPrefill}
        />
      )}

      <aside
        className="hidden lg:flex z-50 flex-col items-center antialiased subpixel-antialiased"
        style={{
          position:             "fixed",
          left:                 16,
          top:                  64,
          bottom:               64,
          width:                SIDE_NAV_W,
          background:           "rgba(13, 11, 20, 0.70)",
          backdropFilter:       "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border:               "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius:         20,
          boxShadow:            "0 12px 32px 4px rgba(0, 0, 0, 0.5), 0 4px 12px 0 rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Jarvis orb — sits inside the 64px top padding zone */}
        <button
          onClick={() => setJarvisOpen(true)}
          aria-label="Open Jarvis"
          className="w-12 h-12 rounded-xl mt-2 transition-transform active:scale-95"
          style={{
            background: "radial-gradient(circle at 35% 30%, rgba(220,235,255,0.95) 0%, rgba(96,165,250,0.55) 50%, rgba(59,130,246,0.20) 100%)",
            boxShadow:  "0 0 22px rgba(59,130,246,0.55), 0 4px 14px rgba(0,0,0,0.40), inset 0 0 18px rgba(255,255,255,0.40)",
            animation:  "jarvisOrbPulse 4s ease-in-out infinite",
          }}
        />

        {/* Left-edge active-indicator pill. Sits at the capsule's left=0
            so it tracks with the floating capsule rather than the viewport
            edge. Slides on top transition between active items. */}
        {activeIndex >= 0 && (
          <span
            aria-hidden="true"
            className="absolute left-0 rounded-r-full bg-white pointer-events-none"
            style={{
              width:  4,
              height: PILL_HEIGHT,
              top:    PILL_OFFSET_Y + activeIndex * ITEM_STRIDE,
              transition: "top 200ms ease-in-out",
              transform:  "translateZ(0)",
              willChange: "transform, top",
            }}
          />
        )}

        {/* Nav items — vertical stack at the 64px top padding mark */}
        <nav
          className="flex flex-col items-center space-y-4"
          style={{ marginTop: TOP_PAD - 48 - 8 /* orb (48) + mt-2 (8) consumed already */ }}
        >
          {NAV_TABS.map((tab, i) => {
            const active = activeIndex === i;
            const Icon   = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className={
                  "relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ease-in-out border " +
                  (active
                    ? "border-white/[0.06] hover:border-white/[0.10]"
                    : "border-transparent hover:bg-white/[0.04]")
                }
                style={{
                  background: active ? "#171324" : undefined,
                  color:      active ? "#FFFFFF" : "rgba(255,255,255,0.40)",
                }}
              >
                <Icon
                  size={22}
                  color="currentColor"
                  weight={active ? "fill" : "regular"}
                />
              </Link>
            );
          })}
        </nav>
      </aside>

      <style>{`
        @keyframes jarvisOrbPulse {
          0%, 100% { transform: scale(1);    filter: brightness(1); }
          50%      { transform: scale(1.06); filter: brightness(1.12); }
        }
        aside [href]:not([style*="background"]):hover {
          color: rgba(255, 255, 255, 0.85) !important;
        }
      `}</style>
    </>
  );
}
