"use client";

import Link from "next/link";

const TABS = [
  { key: "life",     label: "Life" },
  { key: "business", label: "Businesses" },
] as const;

export default function GoalsTabBar({ activeTab }: { activeTab: "life" | "business" }) {
  return (
    <div
      className="sticky top-0 z-10 flex gap-0 mb-4"
      style={{
        background: "rgba(5,5,6,0.90)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        marginLeft: "-1rem",
        marginRight: "-1rem",
        paddingLeft: "1rem",
        paddingRight: "1rem",
      }}
    >
      {TABS.map(({ key, label }) => {
        const active = activeTab === key;
        return (
          <Link
            key={key}
            href={`/goals?tab=${key}`}
            className="relative flex-1 text-center py-3 text-[12px] font-semibold uppercase tracking-widest transition-colors"
            style={{ color: active ? "#ffffff" : "#52525b" }}
          >
            {label}
            {active && (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 rounded-full"
                style={{ background: "#ffffff" }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
