"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_TABS } from "@/lib/nav";
import JarvisHUD from "@/app/(app)/jarvis/JarvisHUD";

// Mobile floating-pill nav (hidden ≥lg, SideNav takes over there). Tabs
// come from the shared NAV_TABS (Phosphor icons, regular weight inactive
// / fill weight active so the look matches the launcher reference and
// stays consistent with the desktop SideNav).
//
// The center Jarvis orb sits between the third + fourth tabs (Gym +
// Life) as a separate inline element so it doesn't need a slot in the
// shared NAV_TABS array.

// Width math at 375px viewport with 14px side margins (347px usable):
//   6 × 44 (tabs) + 1 × 48 (orb) + 6 × 3 (gaps) + 2 × 5 (padding) = 340px.
const TAB_W    = 44;
const GAP      = 3;
const CENTER_W = 48;
const PILL_PAD = 5;

// Index of the tab AFTER which the Jarvis orb appears (i.e. orb sits
// between NAV_TABS[ORB_AFTER_TAB] and NAV_TABS[ORB_AFTER_TAB + 1]).
// 3 = Gym, so orb sits between Gym and Life.
const ORB_AFTER_TAB = 3;

export default function BottomNav() {
  const pathname = usePathname();
  const [jarvisOpen, setJarvisOpen]       = useState(false);
  const [jarvisPrefill, setJarvisPrefill] = useState<string | undefined>(undefined);

  // Global "open Jarvis with this prompt" event — lets any surface
  // (e.g. BusinessAgents' Run button) dispatch into Jarvis without
  // wiring its own state up the tree.
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      setJarvisPrefill(detail?.prompt);
      setJarvisOpen(true);
    }
    window.addEventListener("jarvis:open", onOpen as EventListener);
    return () => window.removeEventListener("jarvis:open", onOpen as EventListener);
  }, []);

  const activeTabIndex = NAV_TABS.findIndex(
    (t) => pathname === t.href || pathname.startsWith(t.href + "/"),
  );

  // Convert tab index → visual x offset, accounting for the inline orb.
  function offsetForTab(tabIndex: number): number {
    let x = PILL_PAD;
    for (let i = 0; i < tabIndex; i++) {
      x += TAB_W + GAP;
      if (i === ORB_AFTER_TAB) x += CENTER_W + GAP;
    }
    return x;
  }

  const highlightX = activeTabIndex >= 0 ? offsetForTab(activeTabIndex) : 0;

  return (
    <>
      {jarvisOpen && (
        <JarvisHUD
          onClose={() => { setJarvisOpen(false); setJarvisPrefill(undefined); }}
          initialMessage={jarvisPrefill}
        />
      )}

      <div
        className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none lg:hidden"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)",
          paddingLeft: 14,
          paddingRight: 14,
        }}
      >
        <nav
          className="relative flex items-center gap-1 px-1.5 py-1.5 pointer-events-auto"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%), rgba(20,20,24,0.55)",
            backdropFilter: "blur(36px) saturate(180%)",
            WebkitBackdropFilter: "blur(36px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 14px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
            borderRadius: 9999,
          }}
        >
          {activeTabIndex >= 0 && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: highlightX,
                top: PILL_PAD,
                width: TAB_W,
                height: 48,
                borderRadius: 16,
                background: "#fafafa",
                boxShadow: "0 4px 14px rgba(255,255,255,0.18)",
                transition: "left 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          )}

          {NAV_TABS.map((tab, i) => {
            const active = activeTabIndex === i;
            const Icon   = tab.icon;
            const renderOrbAfter = i === ORB_AFTER_TAB;
            return (
              <span key={tab.href} className="flex items-center gap-1">
                <Link
                  href={tab.href}
                  aria-label={tab.label}
                  className="tap relative flex flex-col items-center justify-center h-12 rounded-2xl"
                  style={{
                    width: TAB_W,
                    color: active ? "#0b0716" : "#a1a1aa",
                    transition: "color 200ms ease, transform 120ms cubic-bezier(0.22,1,0.36,1)",
                  }}
                >
                  <Icon size={22} weight={active ? "fill" : "regular"} />
                </Link>
                {renderOrbAfter && (
                  <button
                    key="jarvis"
                    onClick={() => setJarvisOpen(true)}
                    className="relative flex items-center justify-center w-12 h-12 rounded-full transition-transform active:scale-95"
                    style={{
                      background: "radial-gradient(circle at 35% 30%, rgba(220,235,255,0.95) 0%, rgba(96,165,250,0.55) 50%, rgba(59,130,246,0.20) 100%)",
                      boxShadow: "0 0 22px rgba(59,130,246,0.55), 0 4px 14px rgba(0,0,0,0.40), inset 0 0 18px rgba(255,255,255,0.40)",
                      animation: "jarvisOrbPulse 4s ease-in-out infinite",
                    }}
                    aria-label="Open Jarvis"
                  />
                )}
              </span>
            );
          })}
        </nav>
      </div>

      <style>{`
        @keyframes jarvisOrbPulse {
          0%, 100% { transform: scale(1);    filter: brightness(1); }
          50%      { transform: scale(1.06); filter: brightness(1.12); }
        }
      `}</style>
    </>
  );
}
