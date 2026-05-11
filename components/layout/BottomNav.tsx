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

      <nav
        className="fixed bottom-0 inset-x-0 z-50 pb-safe"
        style={{
          background: "rgba(5,5,6,0.90)",
          backdropFilter: "blur(24px) saturate(1.2)",
          WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="grid h-14" style={{ gridTemplateColumns: "1fr 1fr 56px 1fr 1fr" }}>
          {tabs.map((tab, i) => {
            if ("center" in tab && tab.center) {
              return (
                <div key="log" className="flex items-center justify-center">
                  <button
                    onClick={() => setLogOpen(true)}
                    className="flex items-center justify-center w-11 h-11 rounded-full transition-transform active:scale-95"
                    style={{
                      background: "#ffffff",
                      boxShadow: "0 0 20px rgba(255,255,255,0.15)",
                    }}
                    aria-label="Log"
                  >
                    <Plus size={20} strokeWidth={2.5} className="text-black" />
                  </button>
                </div>
              );
            }

            const { href, label, icon: Icon } = tab as { href: string; label: string; icon: typeof Home };
            const active = pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={href}
                href={href}
                className={`tap flex flex-col items-center justify-center gap-0.5 ${
                  active ? "text-white" : "text-zinc-600"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
                <span className="text-[9px] font-medium uppercase tracking-widest">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
