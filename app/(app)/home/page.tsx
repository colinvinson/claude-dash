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

  // Surprise PB detector — server-side dedup means firing every mount is safe.
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

      <div className="anim-fade-up"><WelcomeCard /></div>

      {health.todays_call_severity === "red" && health.todays_call_body && (
        <div className="anim-fade-up">
          <TodaysCall severity={health.todays_call_severity} headline={health.todays_call_body} bullets={[]} />
        </div>
      )}

      <div className="anim-fade-up"><StreakAlert /></div>
      <div className="anim-fade-up"><DayBrief /></div>
      <div className="anim-fade-up stagger-1"><RightNowCard /></div>
      <div className="anim-fade-up stagger-2"><TodayWrap /></div>
      <div className="anim-fade-up stagger-3">
        <PriorityFocusCard goals={goals} totalGoals={goals.length} onToggle={toggleGoal} />
      </div>
      <div className="anim-fade-up stagger-4"><Card><DayRing /></Card></div>
      <div className="anim-fade-up stagger-5"><QuickStatsStrip pills={pills} /></div>
      <div className="anim-fade-up stagger-6"><PushSubscriber /></div>
    </>
  );
}
