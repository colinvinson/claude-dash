// Single source of truth for app navigation tabs. Consumed by both
// BottomNav (mobile, fixed-bottom pill) and SideNav (desktop, left rail)
// so the two surfaces stay in sync — adding a tab in one place
// automatically lights up both.
//
// The Jarvis orb is NOT in this list — it's a special centerpiece
// element each nav renders in its own way (center of the pill on
// mobile, top of the rail on desktop).

import type { ComponentType } from "react";
import { Home, CalendarClock, Dumbbell, Target, Briefcase, Wallet } from "lucide-react";

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

export type NavTab = {
  href:  string;
  label: string;
  icon:  IconComponent;
};

export const NAV_TABS: readonly NavTab[] = [
  { href: "/home",       label: "Home",     icon: Home },
  { href: "/schedule",   label: "Schedule", icon: CalendarClock },
  { href: "/gym",        label: "Gym",      icon: Dumbbell },
  { href: "/life",       label: "Life",     icon: Target },
  { href: "/businesses", label: "Biz",      icon: Briefcase },
  { href: "/finances",   label: "Money",    icon: Wallet },
] as const;
