"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarClock, Dumbbell, Target, Briefcase, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import JarvisHUD from "@/app/(app)/jarvis/JarvisHUD";

// 7-tab nav (6 icon tabs + center Jarvis orb). Finances earns its slot
// because wealth-building is one of Sir's primary stated goals — the
// surface where money decisions actually happen.
const tabs = [
  { href: "/home",       label: "Home",       icon: Home },
  { href: "/schedule",   label: "Schedule",   icon: CalendarClock },
  { href: "/gym",        label: "Gym",        icon: Dumbbell },
  { center: true,        label: "Jarvis" },
  { href: "/life",       label: "Life",       icon: Target },
  { href: "/businesses", label: "Biz",        icon: Briefcase },
  { href: "/finances",   label: "Money",      icon: Wallet },
] as const;

// Tabs slimmed 50 → 44 (still Apple HIG floor with padding) to fit 6
// icon tabs + orb on a 375px-wide phone. Width math:
//   6 × 44 (icons) + 1 × 48 (orb) + 6 × 3 (gaps) + 2 × 5 (padding) = 340px.
// Fits inside a 375px viewport with 14px margins both sides (347px usable).
const TAB_W    = 44;
const GAP      = 3;
const CENTER_W = 48;
const PILL_PAD = 5;

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

  const activeIndex = (() => {
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      if ("center" in t && t.center) continue;
      const href = (t as { href: string }).href;
      if (pathname === href || pathname.startsWith(href + "/")) return i;
    }
    return -1;
  })();

  function offsetFor(index: number): number {
    let x = PILL_PAD;
    for (let i = 0; i < index; i++) {
      const t = tabs[i];
      const w = ("center" in t && t.center) ? CENTER_W : TAB_W;
      x += w + GAP;
    }
    return x;
  }

  const highlightX = activeIndex >= 0 ? offsetFor(activeIndex) : 0;

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
          {activeIndex >= 0 && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: highlightX,
                top: PILL_PAD,
                width: TAB_W,
                height: 48,
                borderRadius: 9999,
                background: "rgba(255,255,255,0.12)",
                transition: "left 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          )}

          {tabs.map((tab, i) => {
            if ("center" in tab && tab.center) {
              return (
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
              );
            }

            const tabWithHref = tab as { href: string; label: string; icon: typeof Home };
            const { href, label, icon: Icon } = tabWithHref;
            const active = activeIndex === i;

            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="tap relative flex flex-col items-center justify-center h-12 rounded-full"
                style={{
                  width: TAB_W,
                  color: active ? "#fafafa" : "#a1a1aa",
                  transition: "color 200ms ease, transform 120ms cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
                {active && (
                  <span className="text-[9px] font-semibold uppercase tracking-widest mt-0.5 anim-fade">{label}</span>
                )}
              </Link>
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
