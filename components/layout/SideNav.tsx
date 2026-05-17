"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_TABS } from "@/lib/nav";
import JarvisHUD from "@/app/(app)/jarvis/JarvisHUD";

// Desktop-only left rail nav. Mirrors BottomNav's tabs in a vertical
// stack, with the Jarvis orb at the top as the centerpiece (instead
// of in the middle of a pill, since vertical stacks don't have an
// obvious "center"). Hidden on screens < lg (1024px) — phones get
// BottomNav instead.
//
// Width 76px, full viewport height, glass background matching the
// BottomNav pill aesthetic. Active tab gets the same translucent-
// white highlight + label appears under the icon.

export const SIDE_NAV_W = 76;

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
        className="hidden lg:flex fixed left-0 top-0 bottom-0 z-50 flex-col items-center py-5"
        style={{
          width: SIDE_NAV_W,
          background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%), rgba(18,18,24,0.65)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          paddingTop: "calc(env(safe-area-inset-top) + 20px)",
        }}
      >
        {/* Jarvis orb — top of the rail, the brand-defining centerpiece. */}
        <button
          onClick={() => setJarvisOpen(true)}
          aria-label="Open Jarvis"
          className="relative w-12 h-12 rounded-full transition-transform active:scale-95 mb-6 flex-shrink-0"
          style={{
            background: "radial-gradient(circle at 35% 30%, rgba(220,235,255,0.95) 0%, rgba(96,165,250,0.55) 50%, rgba(59,130,246,0.20) 100%)",
            boxShadow:  "0 0 22px rgba(59,130,246,0.55), 0 4px 14px rgba(0,0,0,0.40), inset 0 0 18px rgba(255,255,255,0.40)",
            animation:  "jarvisOrbPulse 4s ease-in-out infinite",
          }}
        />

        {/* Tabs — vertical stack. Active item gets a SOLID white squircle
            fill with a DARK icon inside, matching the premium-launcher
            screenshot's active state. Inactive icons are translucent
            zinc on transparent background. */}
        <nav className="flex flex-col gap-2 flex-1 w-full items-center">
          {NAV_TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            const Icon   = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className="relative flex items-center justify-center w-12 h-12 rounded-2xl"
                style={{
                  background: active ? "#fafafa" : "transparent",
                  color:      active ? "#0b0716" : "#a1a1aa",
                  boxShadow:  active ? "0 6px 18px rgba(255,255,255,0.12)" : undefined,
                  transition: "background-color 240ms cubic-bezier(0.22,1,0.36,1), color 200ms ease",
                }}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
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
