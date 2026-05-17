"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Gear } from "@phosphor-icons/react";
import { NAV_TABS } from "@/lib/nav";
import JarvisHUD from "@/app/(app)/jarvis/JarvisHUD";

// Floating dock sidebar — 1:1 launcher-shell spec replica.
//
//   Width                 64px
//   Position              fixed, 24px from left + top + bottom
//   Height                calc(100vh - 48px) implicit via top+bottom
//   Background            solid #161223
//   Border                1px solid rgba(255, 255, 255, 0.05)
//   Radius                24px on all four corners
//   Box shadow            0 12px 40px 0 rgba(0, 0, 0, 0.5)
//   z-index               40
//   Inner padding         16px top + bottom, items centered horizontally
//
// Internal layout: flex-col + justify-between → Top Navigation Group
// (brand mark + nav tabs) at top, Bottom System Group (settings) at
// bottom. Top group gap 12px (space-y-3); bottom 16px (space-y-4).
//
// Top slot 0 is the four-square multi-color brand mark — tapping
// opens Jarvis. The remaining top slots are the standard NAV_TABS.
//
// Active state: 44×44 bounding, 14px radius, #221C33 fill,
// 1px rgba(255,255,255,0.08) inner stroke, pure white 20px icon.
// No edge pill — selection communicated purely via box shift.

export const SIDE_NAV_W = 64;

const ITEM_BOX  = 44;
const ITEM_RAD  = 14;
const ICON_SIZE = 20;

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
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <>
      {jarvisOpen && (
        <JarvisHUD
          onClose={() => { setJarvisOpen(false); setJarvisPrefill(undefined); }}
          initialMessage={jarvisPrefill}
        />
      )}

      <aside
        className="hidden lg:flex flex-col justify-between items-center antialiased subpixel-antialiased"
        style={{
          position:        "fixed",
          left:            24,
          top:             24,
          bottom:          24,
          width:           SIDE_NAV_W,
          background:      "#161223",
          border:          "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius:    24,
          boxShadow:       "0 12px 40px 0 rgba(0, 0, 0, 0.5)",
          padding:         "16px 0",
          zIndex:          40,
        }}
      >
        {/* ── TOP NAVIGATION GROUP — brand mark + nav tabs ── */}
        <div className="flex flex-col items-center space-y-3">
          {/* Four-square brand mark — taps open Jarvis. Quadrant tints
              are pastel branding colors per spec. */}
          <button
            onClick={() => setJarvisOpen(true)}
            aria-label="Open Jarvis"
            className="relative flex items-center justify-center transition-all duration-150 ease-out"
            style={{
              width:        ITEM_BOX,
              height:       ITEM_BOX,
              borderRadius: ITEM_RAD,
            }}
          >
            <div
              className="grid grid-cols-2 gap-0.5"
              style={{ width: ICON_SIZE, height: ICON_SIZE }}
            >
              <span className="rounded-[3px]" style={{ background: "#F472B6" }} />{/* magenta */}
              <span className="rounded-[3px]" style={{ background: "#6EE7B7" }} />{/* mint */}
              <span className="rounded-[3px]" style={{ background: "#38BDF8" }} />{/* cyan */}
              <span className="rounded-[3px]" style={{ background: "#FDBA74" }} />{/* peach */}
            </div>
          </button>

          {/* Standard nav tabs */}
          {NAV_TABS.map((tab, i) => {
            const active = activeIndex === i;
            const Icon   = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className="nav-item relative flex items-center justify-center transition-all duration-150 ease-out"
                data-active={active ? "true" : "false"}
                style={{
                  width:        ITEM_BOX,
                  height:       ITEM_BOX,
                  borderRadius: ITEM_RAD,
                  background:   active ? "#221C33" : "transparent",
                  border:       active ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid transparent",
                  color:        active ? "#FFFFFF" : "rgba(255, 255, 255, 0.45)",
                }}
              >
                <Icon size={ICON_SIZE} color="currentColor" weight="regular" />
              </Link>
            );
          })}
        </div>

        {/* ── BOTTOM SYSTEM GROUP — settings ── */}
        <div className="flex flex-col items-center space-y-4">
          <Link
            href="/settings"
            aria-label="Settings"
            className="nav-item relative flex items-center justify-center transition-all duration-150 ease-out"
            data-active={settingsActive ? "true" : "false"}
            style={{
              width:        ITEM_BOX,
              height:       ITEM_BOX,
              borderRadius: ITEM_RAD,
              background:   settingsActive ? "#221C33" : "transparent",
              border:       settingsActive ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid transparent",
              color:        settingsActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.45)",
            }}
          >
            <Gear size={ICON_SIZE} color="currentColor" weight="regular" />
          </Link>
        </div>
      </aside>

      <style>{`
        /* Hover only fires on inactive items. Tailwind hover modifiers
           can't reliably override inline style; do it in scoped CSS. */
        aside .nav-item[data-active="false"]:hover {
          background: rgba(255, 255, 255, 0.03) !important;
          color:      rgba(255, 255, 255, 0.80) !important;
        }
      `}</style>
    </>
  );
}
