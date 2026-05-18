"use client";

import { useEffect } from "react";
import OperatorCard      from "@/components/dashboard/OperatorCard";
import SessionCard       from "@/components/dashboard/SessionCard";
import HabitsCard        from "@/components/dashboard/HabitsCard";
import CalendarCard      from "@/components/dashboard/CalendarCard";
import KeyBlockersCard   from "@/components/dashboard/KeyBlockersCard";
import FinancePulseCard  from "@/components/dashboard/FinancePulseCard";
import NutritionCard     from "@/components/dashboard/NutritionCard";
import StreakCelebration from "@/components/home/StreakCelebration";

// Home — V2. Literal Miles OS 3-column layout, Rowan data wired in.
//
// Desktop layout (lg+):
//   ┌────────┬──────────────┬────────┐
//   │ 01 OP  │  02 SESSION  │ 08 NUT │
//   │ 07 FIN │  03 HABITS   │        │
//   │ 06 BLK │  04 CALENDAR │        │
//   └────────┴──────────────┴────────┘
//
// Mobile: collapses to single column, vertical stack in
// Operator → Session → Habits → Calendar → Finance → Blockers → Nutrition
// order so the most actionable stuff (greeting + capture + habits) is
// up top.
//
// Old Home cards (WelcomeCard, TodaysCall, StreakAlert, MonthlyRetro,
// DayBrief, TodayWrap, WhatMatters, QuickStatsStrip) are now unused.
// Their data sources stay live for other parts of the app; the visual
// equivalents are absorbed:
//   - WelcomeCard / StreakAlert → Operator (streak)
//   - TodaysCall / DayBrief AI summary → moves to Review tab (Phase 5)
//   - TodayWrap (score + rings) → kept conceptually; future "Stats"
//     subview in Operator may surface the score number
//   - QuickStatsStrip → Habits card (covers supps + done count)
//   - MonthlyRetro → moves to dedicated Review tab (Phase 5)

export default function HomePage() {
  // PB detector still fires once a day — keeps the insight pipeline alive
  // even though the inbound surface moved.
  useEffect(() => {
    void fetch("/api/jarvis/pb-insights", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <>
      <StreakCelebration />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px] gap-4">
        {/* Left column */}
        <div className="space-y-4 anim-fade-up">
          <OperatorCard />
          <FinancePulseCard />
          <KeyBlockersCard />
        </div>

        {/* Center column */}
        <div className="space-y-4 anim-fade-up stagger-1">
          <SessionCard />
          <HabitsCard />
          <CalendarCard />
        </div>

        {/* Right column */}
        <div className="space-y-4 anim-fade-up stagger-2">
          <NutritionCard />
        </div>
      </div>
    </>
  );
}
