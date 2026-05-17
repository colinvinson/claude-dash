"use client";

import { useEffect } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useHealth } from "@/hooks/useHealth";
import { useStack } from "@/hooks/useStack";
import { useWorkout } from "@/hooks/useWorkout";
import { useDailyContext } from "@/hooks/useDailyContext";
import { useLog } from "@/hooks/useLog";
import { useProtein } from "@/hooks/useProtein";
import { useHealthBaselines } from "@/hooks/useHealthBaselines";
import { useWakeConfirm } from "@/hooks/useWakeConfirm";
import { computeDailyScore } from "@/lib/scoring";

import WelcomeCard from "@/components/home/WelcomeCard";
import TodaysCall from "@/components/health/TodaysCall";
import StreakAlert from "@/components/home/StreakAlert";
import MonthlyRetroCard from "@/components/home/MonthlyRetroCard";
import DayBrief from "@/components/home/DayBrief";
import TodayWrap from "@/components/home/TodayWrap";
import WhatMattersCard from "@/components/home/WhatMattersCard";
import QuickStatsStrip from "@/components/home/QuickStatsStrip";
import StreakCelebration from "@/components/home/StreakCelebration";

// Home — hard reset to 5 surfaces (plus conditional alerts).
//
// Editorial rule: every card on Home earns its slot by serving one of two
// jobs — "what's the state right now" (TodayWrap) or "what should I do
// about it" (DayBrief / WhatMatters / QuickStats). Nothing else lives
// here. Tracking lives in LogSheet. Goal management lives in /life and
// /businesses. Notifications config lives in /settings.
//
// Order, top to bottom:
//   conditional alerts (StreakAlert / TodaysCall / WelcomeCard / MonthlyRetro)
//   DayBrief         — morning ritual (plan input + Jarvis briefing)
//   TodayWrap        — HERO (score + 3 rings + recap CTA)
//   WhatMattersCard  — composite: focus goal + today's goals + latest insight
//   QuickStatsStrip  — glance pills (supps, water, mood, gym, protein)

export default function HomePage() {
  const { goals } = useGoals();
  const { health } = useHealth();
  const { items: stackItems } = useStack();
  const { todaySets } = useWorkout();
  const { hasCheckedIn } = useDailyContext();
  const { state: logState } = useLog();
  const { totalToday: proteinToday, target: proteinTarget, pctOfTarget: proteinPct } = useProtein();
  const { baselines } = useHealthBaselines();
  const { today: wakeToday } = useWakeConfirm();

  const supplementsTaken = stackItems.filter((s) => s.taken).length;
  const supplementsTotal = stackItems.length;
  const goalsComplete    = goals.filter((g) => g.is_complete).length;
  const workoutDoneToday = todaySets.length > 0;

  // Score is computed in TodayWrap now — we only derive accent here for
  // the body-data attribute that drives the global radial wash color.
  const { accent } = computeDailyScore({
    goalsComplete,
    goalsTotal: goals.length,
    readinessScore: health.readiness_score,
    readinessBaseline: baselines.readiness_score ?? null,
    workoutDoneToday,
    supplementsTaken,
    supplementsTotal,
    checkedIn: hasCheckedIn,
    proteinPct:    proteinTarget > 0 ? proteinToday / proteinTarget : null,
    proteinTarget: proteinTarget,
    wakeOnTime:    wakeToday?.on_time ?? null,
  });

  // Dynamic body-accent based on daily score was removed — it was
  // overriding the violet base palette. Score is still rendered on
  // TodayWrap with its own color treatment; the page-wide wash stays
  // consistent.

  // PB detector — fires once per day server-side. Insights surface via
  // WhatMattersCard's "Insight" section.
  useEffect(() => {
    void fetch("/api/jarvis/pb-insights", { method: "POST" }).catch(() => {});
  }, []);

  const pills = [
    { label: "Supps",   value: supplementsTotal > 0 ? `${supplementsTaken}/${supplementsTotal}` : "—",
      color: supplementsTaken === supplementsTotal && supplementsTotal > 0 ? "#10b981" : undefined },
    { label: "Water",   value: logState.water > 0 ? `${logState.water} glasses` : "0" },
    { label: "Mood",    value: logState.mood ? ["😞","😐","🙂","😊","🤩"][logState.mood - 1] : "—" },
    { label: "Gym",     value: workoutDoneToday ? "Trained ✓" : "Rest",
      color: workoutDoneToday ? "#10b981" : undefined },
    { label: "Protein", value: `${Math.round(proteinToday)}/${proteinTarget}g`,
      color: proteinPct >= 80 ? "#10b981" : proteinPct >= 50 ? "#f59e0b" : undefined },
  ];

  return (
    <>
      <StreakCelebration />

      {/* Conditional alerts — rendered BARE so when they return null React
          renders nothing AND space-y-5 skips them entirely. No ghost gaps. */}
      <WelcomeCard />
      {health.todays_call_severity === "red" && health.todays_call_body && (
        <TodaysCall severity={health.todays_call_severity} headline={health.todays_call_body} bullets={[]} />
      )}
      <StreakAlert />
      <MonthlyRetroCard />

      {/* The five surfaces — strictly in service order: today's plan,
          today's state (hero), what matters, glance pills. */}
      <div className="anim-fade-up"><DayBrief /></div>
      <div className="anim-fade-up stagger-1"><TodayWrap /></div>
      <div className="anim-fade-up stagger-2"><WhatMattersCard /></div>
      <div className="anim-fade-up stagger-3"><QuickStatsStrip pills={pills} /></div>
    </>
  );
}
