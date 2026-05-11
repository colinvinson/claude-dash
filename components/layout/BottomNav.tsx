"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Leaf, Plus, Bot, BarChart2 } from "lucide-react";
import { useState } from "react";
import LogSheet from "./LogSheet";

const tabs = [
  { href: "/home",  label: "Home",  icon: Home },
  { href: "/life",  label: "Life",  icon: Leaf },
  { center: true,   label: "Log",   icon: Plus },
  { href: "/coach", label: "Coach", icon: Bot },
  { href: "/data",  label: "Data",  icon: BarChart2 },
] as const;

// Per-tab pill width — must match the rendered width below for the slide to land right.
const TAB_W = 56;
const GAP   = 4;     // tailwind gap-1 = 4px
const CENTER_W = 48; // center + button
const PILL_PAD = 6;  // px-1.5 = 6px

export default function BottomNav() {
  const pathname = usePathname();
  const [logOpen, setLogOpen] = useState(false);

  // Active index — needed so the highlight slides to the right position.
  // null when no tab matches (shouldn't happen but safe).
  const activeIndex = (() => {
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      if ("center" in t && t.center) continue;
      const href = (t as { href: string }).href;
      if (pathname === href || pathname.startsWith(href + "/")) return i;
    }
    return -1;
  })();

  // Compute pixel offset of the highlight given the active index.
  // Layout: padding | tab(56) | gap | tab(56) | gap | center(48) | gap | tab(56) | gap | tab(56) | padding
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
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />

      {/* Outer floating container — handles safe-area + horizontal margins */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)",
          paddingLeft: 14,
          paddingRight: 14,
        }}
      >
        {/* The pill itself — liquid glass */}
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
          {/* Sliding active-tab highlight pill */}
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
                  key="log"
                  onClick={() => setLogOpen(true)}
                  className="relative flex items-center justify-center w-12 h-12 rounded-full transition-transform active:scale-95"
                  style={{
                    background: "#ffffff",
                    boxShadow: "0 0 18px rgba(255,255,255,0.22), 0 4px 12px rgba(0,0,0,0.25)",
                  }}
                  aria-label="Log"
                >
                  <Plus size={20} strokeWidth={2.5} className="text-black" />
                </button>
              );
            }

            const { href, label, icon: Icon } = tab as { href: string; label: string; icon: typeof Home };
            const active = activeIndex === i;

            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="tap relative flex flex-col items-center justify-center w-14 h-12 rounded-full"
                style={{
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
    </>
  );
}
