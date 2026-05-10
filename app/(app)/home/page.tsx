"use client";

import { useEffect } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useHealth } from "@/hooks/useHealth";
import { useStack } from "@/hooks/useStack";
import { useWorkout } from "@/hooks/useWorkout";
import { useDailyContext } from "@/hooks/useDailyContext";
import { useLog } from "@/hooks/useLog";
import { computeDailyScore } from "@/lib/scoring";
import Card from "@/components/ui/Card";
import GoalTicker from "@/components/productivity/GoalTicker";
import DayRing from "@/components/health/DayRing";
import TodaysCall from "@/components/health/TodaysCall";
import CheckInCard from "@/components/home/CheckInCard";
import ScoreHeadline from "@/components/home/ScoreHeadline";
import QuickStatsStrip from "@/components/home/QuickStatsStrip";
import PriorityFocusCard from "@/components/home/PriorityFocusCard";
import StreakAlert from "@/components/home/StreakAlert";

export default function HomePage() {
  const { goals, streak, toggleGoal } = useGoals();
  const { health } = useHealth();
  const { items: stackItems } = useStack();
  const { todaySets } = useWorkout();
  const { hasCheckedIn } = useDailyContext();
  const { state: logState } = useLog();

  const supplementsTaken = stackItems.filter((s) => s.taken).length;
  const supplementsTotal = stackItems.length;
  const goalsComplete = goals.filter((g) => g.is_complete).length;
  const workoutDoneToday = todaySets.length > 0;

  const { score, accent, headline } = computeDailyScore({
    goalsComplete,
    goalsTotal: goals.length,
    readinessScore: health.readiness_score,
    workoutDoneToday,
    supplementsTaken,
    supplementsTotal,
    checkedIn: hasCheckedIn,
  });

  // Sync score accent to body for radial wash color shift
  useEffect(() => {
    if (accent !== "amber") {
      document.body.dataset.score = accent;
    } else {
      delete document.body.dataset.score;
    }
    return () => { delete document.body.dataset.score; };
  }, [accent]);

  // Streak at risk: after 8pm, streak > 2, zero goals done
  const now = new Date();
  const streakAtRisk = now.getHours() >= 20 && streak > 2 && goalsComplete === 0;

  // Quick stats pills
  const pills = [
    {
      label: "Supps",
      value: supplementsTotal > 0 ? `${supplementsTaken}/${supplementsTotal}` : "—",
      color: supplementsTaken === supplementsTotal && supplementsTotal > 0 ? "#34d399" : undefined,
    },
    {
      label: "Water",
      value: logState.water > 0 ? `${logState.water} glasses` : "0",
    },
    {
      label: "Mood",
      value: logState.mood ? ["😞","😐","🙂","😊","🤩"][logState.mood - 1] : "—",
    },
    {
      label: "Gym",
      value: workoutDoneToday ? "Trained ✓" : "Rest",
      color: workoutDoneToday ? "#34d399" : undefined,
    },
  ];

  return (
    <>
      {!hasCheckedIn && <CheckInCard />}
      {streakAtRisk && <StreakAlert streak={streak} />}

      <ScoreHeadline score={score} accent={accent} headline={headline} />

      <GoalTicker />

      <QuickStatsStrip pills={pills} />

      <PriorityFocusCard
        goals={goals}
        totalGoals={goals.length}
        onToggle={toggleGoal}
      />

      <Card>
        <DayRing />
      </Card>

      {health.todays_call_severity === "red" && health.todays_call_body && (
        <TodaysCall
          severity={health.todays_call_severity}
          headline={health.todays_call_body}
          bullets={[]}
        />
      )}
    </>
  );
}
