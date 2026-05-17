"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_TABS } from "@/lib/nav";
import JarvisHUD from "@/app/(app)/jarvis/JarvisHUD";

// Edge-anchored, full-height left sidebar. Pixel-perfect spec:
//
//   width                  72px
//   bg                     #0D0B14 (deep matte dark violet-black)
//   border-right           1px solid rgba(255,255,255,0.04)
//   top padding            64px before first item
//   item bounding box      48×48px
//   item radius            12px (rounded-xl)
//   icon size              22×22
//   inter-item gap         16px (space-y-4)
//   active bg              #171324
//   active border tint     1px solid rgba(255,255,255,0.06)
//   active+hover border    rgba(255,255,255,0.10)
//   active icon            #FFFFFF (100% opacity)
//   inactive icon          rgba(255,255,255,0.40)
//   hover bg               rgba(255,255,255,0.04)
//   hover icon             rgba(255,255,255,0.85)
//   transition             all 200ms ease-in-out
//
// Left-edge indicator pill:
//   4×24px, rounded-r-full, anchored to viewport-left (sidebar x=0).
//   Slides via `top` transition on active-index change.
//   will-change-transform for fluid GPU-accelerated motion.
//
// Hidden < lg (1024px) — mobile uses BottomNav instead.

export const SIDE_NAV_W = 72;

// Geometry constants — kept named so the pill-position math reads.
const TOP_PAD       = 64;   // matches spec: 64px from top to first nav item
const ITEM_BOX      = 48;   // item bounding box
const ITEM_GAP      = 16;   // inter-item gap
const ITEM_STRIDE   = ITEM_BOX + ITEM_GAP;  // 64px from item-top to next item-top
const PILL_HEIGHT   = 24;
const PILL_OFFSET_Y = TOP_PAD + (ITEM_BOX - PILL_HEIGHT) / 2;  // y of pill for index 0 = 76

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
        className="hidden lg:flex fixed left-0 top-0 bottom-0 z-50 flex-col items-center antialiased subpixel-antialiased"
        style={{
          width: SIDE_NAV_W,
          background:  "#0D0B14",
          borderRight: "1px solid rgba(255, 255, 255, 0.04)",
        }}
      >
        {/* Jarvis orb — sits inside the 64px top zone, centered horizontally
            in the rail. Same 48×48 + 12px radius as nav items so it slots
            into the visual rhythm. */}
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

        {/* Left-edge active-indicator pill. Anchored to the viewport's left
            margin (sidebar's left=0). Slides via top transition. */}
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

        {/* Nav items — vertical stack starting at TOP_PAD with 16px gaps */}
        <nav
          className="flex flex-col items-center space-y-4"
          style={{ marginTop: TOP_PAD - 48 - 8 /* orb height (48) + its mt-2 (8) consumed already; remaining gap before first item */ }}
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
                {/* Icon picks up color via currentColor. Active = fill weight
                    (solid filled glyph in white); inactive = regular outline. */}
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
        /* Inactive-icon hover brightness lift. Tailwind hover:text-white/[0.85]
           doesn't reliably override inline-style color, so we drive it via
           a CSS rule scoped to the inactive (no #171324 bg) links. */
        aside [href]:not([style*="background"]):hover {
          color: rgba(255, 255, 255, 0.85) !important;
        }
      `}</style>
    </>
  );
}
