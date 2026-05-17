import MesocycleCard from "@/components/fitness/MesocycleCard";
import OptimizationCard from "@/components/fitness/OptimizationCard";
import ProgressiveOverloadCoach from "@/components/fitness/ProgressiveOverloadCoach";
import ProteinCard from "@/components/fitness/ProteinCard";
import WeightTrackerCard from "@/components/fitness/WeightTrackerCard";

// Gym tab — dashboard grid.
//
// Order tuned for "what Sir does when he opens the tab": click Start
// Workout. So the Hypertrophy Coach (which holds the Start Workout
// button + exercise picker + prescription) sits at the TOP, full
// width. Status tiles (Mesocycle + Optimization recommendations) +
// body-comp / nutrition drop below since they're reference data, not
// the action surface.

export default function GymPage() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* The coach — full width, top. Action surface. */}
      <div className="col-span-2 anim-fade-up"><ProgressiveOverloadCoach /></div>

      {/* Status tiles — direction-of-training (where to focus) */}
      <div className="anim-fade-up stagger-1 h-full"><MesocycleCard /></div>
      <div className="anim-fade-up stagger-1 h-full"><OptimizationCard /></div>

      {/* Body composition + nutrition — full width each */}
      <div className="col-span-2 anim-fade-up stagger-2"><WeightTrackerCard /></div>
      <div className="col-span-2 anim-fade-up stagger-3"><ProteinCard /></div>
    </div>
  );
}
