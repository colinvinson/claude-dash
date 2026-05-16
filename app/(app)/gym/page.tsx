import MesocycleCard from "@/components/fitness/MesocycleCard";
import OptimizationCard from "@/components/fitness/OptimizationCard";
import ProgressiveOverloadCoach from "@/components/fitness/ProgressiveOverloadCoach";
import ProteinCard from "@/components/fitness/ProteinCard";
import WeightTrackerCard from "@/components/fitness/WeightTrackerCard";

export default function GymPage() {
  return (
    <div className="space-y-4">
      <div className="anim-fade-up"><MesocycleCard /></div>
      <div className="anim-fade-up stagger-1"><OptimizationCard /></div>
      <div className="anim-fade-up stagger-2"><WeightTrackerCard /></div>
      <div className="anim-fade-up stagger-3"><ProteinCard /></div>
      <div className="anim-fade-up stagger-4"><ProgressiveOverloadCoach /></div>
    </div>
  );
}
