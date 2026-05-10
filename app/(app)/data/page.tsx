"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SubTabBar from "@/components/data/SubTabBar";
import HealthCard from "@/components/health/HealthCard";
import MeditationCard from "@/components/health/MeditationCard";
import DailyStack from "@/components/health/DailyStack";
import MedicationTracker from "@/components/health/MedicationTracker";
import VeloTracker from "@/components/health/VeloTracker";
import ProgressiveOverloadCoach from "@/components/fitness/ProgressiveOverloadCoach";
import FinancesContent from "./FinancesContent";

function DataInner() {
  const params = useSearchParams();
  const tab = params.get("tab") ?? "health";

  return (
    <>
      <SubTabBar activeTab={tab} />

      {tab === "health" && (
        <>
          <HealthCard />
          <MeditationCard />
          <DailyStack />
          <MedicationTracker />
          <VeloTracker />
        </>
      )}

      {tab === "fitness" && <ProgressiveOverloadCoach />}

      {tab === "finances" && <FinancesContent />}
    </>
  );
}

export default function DataPage() {
  return (
    <Suspense>
      <DataInner />
    </Suspense>
  );
}
