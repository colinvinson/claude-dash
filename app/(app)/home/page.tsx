"use client";

import { useEffect } from "react";
import Card from "@/components/ui/Card";
import { useGoals } from "@/hooks/useGoals";
import { useHealth } from "@/hooks/useHealth";
import { useStack } from "@/hooks/useStack";
import { useWorkout } from "@/hooks/useWorkout";
import { useDailyContext } from "@/hooks/useDailyContext";
import { useLog } from "@/hooks/useLog";
import { useProtein } from "@/hooks/useProtein";
import { useHealthBaselines } from "@/hooks/useHealthBaselines";
import { computeDailyScore } from "@/lib/scoring";

import WelcomeCard from "@/components/home/WelcomeCard";
import TodaysCall from "@/components/health/TodaysCall";
import StreakAlert from "@/components/home/StreakAlert";
import DayBrief from "@/components/home/DayBrief";
import RightNowCard from "@/components/home/RightNowCard";
import TodayWrap from "@/components/home/TodayWrap";
import PriorityFocusCard from "@/components/home/PriorityFocusCard";
import DayRing from "@/components/health/DayRing";
import QuickStatsStrip from "@/components/home/QuickStatsStrip";
import StreakCelebration from "@/components/home/StreakCelebration";
import PushSubscriber from "@/components/home/PushSubscriber";
import LongTermGoalsCard from "@/components/home/LongTermGoalsCard";
import DailyInsightStrip from "@/components/home/DailyInsightStrip";
import MonthlyRetroCard from "@/components/home/MonthlyRetroCard";
import DimensionsCard from "@/components/home/DimensionsCard";

// Home tab — consolidated cohesion pass.
//
// Render order (most cards conditional — typical day shows 6-7, not 16):
//   1. WelcomeCard         — true first-time only
//   2. TodaysCall          — red biometric severity only
//   3. StreakAlert         — at-risk / paused-streak / late-day-prompt
//   4. DayBrief            — plan input + Jarvis briefing (merged)
//   5. RightNowCard        — ADHD one-action picker
//   6. TodayWrap           — score + rings + recap (the day-card)
//   7. PriorityFocusCard   — top 3 incomplete goals
//   8. DayRing             — temporal phase
//   9. QuickStatsStrip     — glance pill row
//  10. PushSubscriber      — idempotent

export default function HomePage() {
  const { goals, toggleGoal } = useGoals();
  const { health } = useHealth();
  const { items: stackItems } = useStack();
  const { todaySets } = useWorkout();
  const { hasCheckedIn } = useDailyContext();
  const { state: logState } = useLog();
  const { totalToday: proteinToday, target: proteinTarget, pctOfTarget: proteinPct } = useProtein();
  const { baselines } = useHealthBaselines();

  const supplementsTaken = stackItems.filter((s) => s.taken).length;
  const supplementsTotal = stackItems.length;
  const goalsComplete    = goals.filter((g) => g.is_complete).length;
  const workoutDoneToday = todaySets.length > 0;

  // Score is computed in TodayWrap now. We still derive accent here for the
  // body-data attribute that drives the radial wash color.
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
  });

  // Body data attr for the global radial wash background color.
  useEffect(() => {
    if (accent !== "amber") document.body.dataset.score = accent;
    else delete document.body.dataset.score;
    return () => { delete document.body.dataset.score; };
  }, [accent]);

  // PB detector still fires alongside the daily-insights strip — they
  // coexist (PB writes kind="pb", daily-insights writes performance/
  // recovery/goal). Both dedupe server-side per day.
  useEffect(() => {
    void fetch("/api/jarvis/pb-insights", { method: "POST" }).catch(() => {});
  }, []);

  // QuickStatsStrip data — passive pill row of "things logged today."
  const pills = [
    {
      label: "Supps",
      value: supplementsTotal > 0 ? `${supplementsTaken}/${supplementsTotal}` : "—",
      color: supplementsTaken === supplementsTotal && supplementsTotal > 0 ? "#10b981" : undefined,
    },
    { label: "Water", value: logState.water > 0 ? `${logState.water} glasses` : "0" },
    { label: "Mood",  value: logState.mood ? ["😞","😐","🙂","😊","🤩"][logState.mood - 1] : "—" },
    { label: "Gym",   value: workoutDoneToday ? "Trained ✓" : "Rest", color: workoutDoneToday ? "#10b981" : undefined },
    { label: "Protein", value: `${Math.round(proteinToday)}/${proteinTarget}g`, color: proteinPct >= 80 ? "#10b981" : proteinPct >= 50 ? "#f59e0b" : undefined },
  ];

  return (
    <>
      <StreakCelebration />

      {/* Conditional alerts — rendered bare (no wrapper divs) so when they
          return null React renders nothing AND the parent's space-y-5
          selector skips them. Putting them inside the grid would leave
          ghost cells with grid-gap. */}
      <WelcomeCard />
      {health.todays_call_severity === "red" && health.todays_call_body && (
        <TodaysCall severity={health.todays_call_severity} headline={health.todays_call_body} bullets={[]} />
      )}
      <StreakAlert />

      {/* Dashboard grid. col-span-2 = full width (most cards), no span =
          half width (paired tiles). The 2-col tile row (PriorityFocus +
          DayRing) is the visual break that turns Home from "list of cards"
          into a dashboard. */}
      <div className="grid grid-cols-2 gap-3">
        {/* Morning ritual */}
        <div className="col-span-2 anim-fade-up"><DayBrief /></div>

        {/* Monthly retrospective — fires once at the start of each new
            month (first 7 days). Quiets after dismiss or once outside
            the window. */}
        <div className="col-span-2 anim-fade-up"><MonthlyRetroCard /></div>

        {/* Jarvis insights — proactive observations Sir didn't have to ask
            about. Surfaces 1-3 fresh observations per day across
            performance / recovery / goal categories, plus weekly
            cross-dimension correlations. Quiet when there's nothing
            flagged. */}
        <div className="col-span-2 anim-fade-up stagger-1"><DailyInsightStrip /></div>

        {/* HERO — score + 3 rings + recap */}
        <div className="col-span-2 anim-fade-up stagger-1"><TodayWrap /></div>

        {/* Long-term goals — the dashboard's reason for existing.
            Surfaces star-flagged "focus" goals (up to 3) so they're
            visible from Home, not buried in /goals. */}
        <div className="col-span-2 anim-fade-up stagger-1"><LongTermGoalsCard /></div>

        {/* Beyond the body — the 9 dimensions (focus, cardio, social,
            libido, aesthetic, sun, caffeine, learning, money). Gives the
            tracked data visible presence instead of dying inside LogSheet. */}
        <div className="col-span-2 anim-fade-up stagger-2"><DimensionsCard /></div>

        {/* Primary CTA — full width */}
        <div className="col-span-2 anim-fade-up stagger-2"><RightNowCard /></div>

        {/* 2-col tile row — Focus goals + time-of-day phase.
            `items-stretch` on the grid + `h-full` on each child = equal
            height regardless of content (avoids the "DayRing towers over
            an empty PriorityFocus" mismatch). */}
        <div className="anim-fade-up stagger-3 h-full">
          <PriorityFocusCard goals={goals} totalGoals={goals.length} onToggle={toggleGoal} />
        </div>
        <div className="anim-fade-up stagger-3 h-full">
          <Card className="h-full"><DayRing /></Card>
        </div>

        {/* Glance pills — already a horizontal layout */}
        <div className="col-span-2 anim-fade-up stagger-4"><QuickStatsStrip pills={pills} /></div>

        {/* Idempotent — vanishes after subscribed */}
        <div className="col-span-2 anim-fade-up stagger-5"><PushSubscriber /></div>
      </div>
    </>
  );
}
