import MesocycleCard from "@/components/fitness/MesocycleCard";
import ProgressiveOverloadCoach from "@/components/fitness/ProgressiveOverloadCoach";
import ProteinCard from "@/components/fitness/ProteinCard";
import WeightTrackerCard from "@/components/fitness/WeightTrackerCard";

export default function GymPage() {
  return (
    <div className="space-y-4">
      <div className="anim-fade-up"><MesocycleCard /></div>
      <div className="anim-fade-up stagger-1"><WeightTrackerCard /></div>
      <div className="anim-fade-up stagger-2"><ProteinCard /></div>
      <div className="anim-fade-up stagger-3"><ProgressiveOverloadCoach /></div>
    </div>
  );
}
