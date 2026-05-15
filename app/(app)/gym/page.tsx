import ProgressiveOverloadCoach from "@/components/fitness/ProgressiveOverloadCoach";
import ProteinCard from "@/components/fitness/ProteinCard";

export default function GymPage() {
  return (
    <div className="space-y-4">
      <div className="anim-fade-up"><ProteinCard /></div>
      <div className="anim-fade-up stagger-1"><ProgressiveOverloadCoach /></div>
    </div>
  );
}
