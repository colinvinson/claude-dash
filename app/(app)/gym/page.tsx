import ProgressiveOverloadCoach from "@/components/fitness/ProgressiveOverloadCoach";
import ProteinCard from "@/components/fitness/ProteinCard";
import WeightTrackerCard from "@/components/fitness/WeightTrackerCard";

export default function GymPage() {
  return (
    <div className="space-y-4">
      <div className="anim-fade-up"><WeightTrackerCard /></div>
      <div className="anim-fade-up stagger-1"><ProteinCard /></div>
      <div className="anim-fade-up stagger-2"><ProgressiveOverloadCoach /></div>
    </div>
  );
}
