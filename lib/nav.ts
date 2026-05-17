// Single source of truth for app navigation tabs. Consumed by both
// BottomNav (mobile, fixed-bottom pill) and SideNav (desktop, left rail)
// so the two surfaces stay in sync.
//
// Uses Phosphor icons because they ship both `regular` (outline) and
// `fill` (solid) weights for every icon — letting us do the
// "outline-when-inactive, filled-when-active" pattern the premium
// launcher reference uses. Lucide is still the icon library
// everywhere else in the app; Phosphor is nav-only.

import type { Icon } from "@phosphor-icons/react";
import {
  House,
  CalendarBlank,
  Barbell,
  Target,
  Briefcase,
  Wallet,
} from "@phosphor-icons/react";

export type NavTab = {
  href:  string;
  label: string;
  icon:  Icon;
};

export const NAV_TABS: readonly NavTab[] = [
  { href: "/home",       label: "Home",     icon: House },
  { href: "/schedule",   label: "Schedule", icon: CalendarBlank },
  { href: "/gym",        label: "Gym",      icon: Barbell },
  { href: "/life",       label: "Life",     icon: Target },
  { href: "/businesses", label: "Biz",      icon: Briefcase },
  { href: "/finances",   label: "Money",    icon: Wallet },
] as const;
