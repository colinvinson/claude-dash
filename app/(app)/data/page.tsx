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
          <div className="anim-fade-up"><HealthCard /></div>
          <div className="anim-fade-up stagger-2"><MeditationCard /></div>
          <div className="anim-fade-up stagger-3"><DailyStack /></div>
          <div className="anim-fade-up stagger-4"><MedicationTracker /></div>
          <div className="anim-fade-up stagger-5"><VeloTracker /></div>
        </>
      )}

      {tab === "fitness" && <div className="anim-fade-up"><ProgressiveOverloadCoach /></div>}

      {tab === "finances" && <div className="anim-fade-up"><FinancesContent /></div>}
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
