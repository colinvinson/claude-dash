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

export default function BottomNav() {
  const pathname = usePathname();
  const [logOpen, setLogOpen] = useState(false);

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
          className="flex items-center gap-1 px-1.5 py-1.5 pointer-events-auto"
          style={{
            // Tinted base + subtle top-to-bottom sheen for depth
            background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%), rgba(20,20,24,0.55)",
            backdropFilter: "blur(36px) saturate(180%)",
            WebkitBackdropFilter: "blur(36px) saturate(180%)",
            // Edge highlight + outer shadow for the floating feel
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 14px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
            borderRadius: 9999,
          }}
        >
          {tabs.map((tab) => {
            if ("center" in tab && tab.center) {
              return (
                <button
                  key="log"
                  onClick={() => setLogOpen(true)}
                  className="flex items-center justify-center w-12 h-12 rounded-full transition-transform active:scale-95"
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
            const active = pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="tap flex flex-col items-center justify-center w-14 h-12 rounded-full"
                style={{
                  background: active ? "rgba(255,255,255,0.12)" : "transparent",
                  color: active ? "#fafafa" : "#a1a1aa",
                  transition: "background-color 200ms ease, color 200ms ease, transform 120ms cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
                {active && (
                  <span className="text-[9px] font-semibold uppercase tracking-widest mt-0.5">{label}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
