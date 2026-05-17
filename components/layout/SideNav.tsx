"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_TABS } from "@/lib/nav";
import JarvisHUD from "@/app/(app)/jarvis/JarvisHUD";

// Desktop-only left rail nav. Mirrors BottomNav's tabs in a vertical
// stack with the Jarvis orb at the top. Hidden on screens < lg
// (1024px); phones get BottomNav instead.
//
// FLOATING SQUIRCLE — not edge-to-edge. Sits inside the viewport with
// equal margins on the left, top, and bottom (matches the premium
// game-launcher reference where the sidebar reads as its own object,
// not part of the chrome). Width 68px + 12px gap on each side = the
// content's left padding is 92px on lg.

export const SIDE_NAV_W   = 88;
export const SIDE_NAV_GAP = 12;
export const SIDE_NAV_OFFSET = SIDE_NAV_W + SIDE_NAV_GAP * 2;  // 112px

export default function SideNav() {
  const pathname = usePathname();
  const [jarvisOpen, setJarvisOpen]       = useState(false);
  const [jarvisPrefill, setJarvisPrefill] = useState<string | undefined>(undefined);

  // Same global open-Jarvis event channel that BottomNav listens on.
  // BOTH navs listen so the event works on either form factor; only
  // one HUD will be visible at a time since the responsive visibility
  // hides one of them.
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      setJarvisPrefill(detail?.prompt);
      setJarvisOpen(true);
    }
    window.addEventListener("jarvis:open", onOpen as EventListener);
    return () => window.removeEventListener("jarvis:open", onOpen as EventListener);
  }, []);

  return (
    <>
      {jarvisOpen && (
        <JarvisHUD
          onClose={() => { setJarvisOpen(false); setJarvisPrefill(undefined); }}
          initialMessage={jarvisPrefill}
        />
      )}

      <aside
        className="hidden lg:flex fixed z-50 flex-col items-center py-5"
        style={{
          left:   SIDE_NAV_GAP,
          top:    SIDE_NAV_GAP,
          bottom: SIDE_NAV_GAP,
          width:  SIDE_NAV_W,
          background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%), rgba(18,18,28,0.62)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 28,
          boxShadow: "0 18px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)",
        }}
      >
        {/* Jarvis orb — top of the rail, the brand-defining centerpiece. */}
        <button
          onClick={() => setJarvisOpen(true)}
          aria-label="Open Jarvis"
          className="relative w-14 h-14 rounded-full transition-transform active:scale-95 mb-7 flex-shrink-0"
          style={{
            background: "radial-gradient(circle at 35% 30%, rgba(220,235,255,0.95) 0%, rgba(96,165,250,0.55) 50%, rgba(59,130,246,0.20) 100%)",
            boxShadow:  "0 0 24px rgba(59,130,246,0.55), 0 4px 14px rgba(0,0,0,0.40), inset 0 0 18px rgba(255,255,255,0.40)",
            animation:  "jarvisOrbPulse 4s ease-in-out infinite",
          }}
        />

        {/* Tabs — vertical stack. Active item gets a SOLID white squircle
            fill with a DARK icon inside, matching the premium-launcher
            screenshot. Inactive icons are translucent zinc on
            transparent background. Bigger items (w-16 h-16, 28px icons)
            to give the rail visual weight matching the reference. */}
        <nav className="flex flex-col gap-2.5 flex-1 w-full items-center">
          {NAV_TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            const Icon   = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className="relative flex items-center justify-center w-16 h-16 rounded-2xl"
                style={{
                  // Active = RAISED dark squircle that floats above the
                  // rail surface. Gradient slightly brighter at the top
                  // (catches light) → darker at the bottom (recedes).
                  // Drop shadow underneath plus a thin lit edge at the
                  // top reads as physically lifted above the surface.
                  background: active
                    ? "linear-gradient(180deg, rgba(35,35,50,0.95) 0%, rgba(15,15,25,0.95) 100%)"
                    : "transparent",
                  color:      active ? "#fafafa" : "#a1a1aa",
                  boxShadow:  active
                    ? [
                        "0 8px 18px rgba(0,0,0,0.55)",          // main drop shadow
                        "0 2px 5px rgba(0,0,0,0.40)",           // tight cast shadow
                        "inset 0 1px 0 rgba(255,255,255,0.12)", // lit top edge
                        "inset 0 -1px 0 rgba(0,0,0,0.30)",      // dark bottom rim
                      ].join(", ")
                    : undefined,
                  transition: "background 240ms cubic-bezier(0.22,1,0.36,1), color 200ms ease",
                }}
              >
                <Icon size={26} weight={active ? "regular" : "light"} />
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
      `}</style>
    </>
  );
}
