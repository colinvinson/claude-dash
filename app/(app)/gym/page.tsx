import MesocycleCard from "@/components/fitness/MesocycleCard";
import OptimizationCard from "@/components/fitness/OptimizationCard";
import ProgressiveOverloadCoach from "@/components/fitness/ProgressiveOverloadCoach";
import ProteinCard from "@/components/fitness/ProteinCard";
import WeightTrackerCard from "@/components/fitness/WeightTrackerCard";

// Gym tab — dashboard grid, same pattern as Home.
//
// Mesocycle + Optimization pair as half-width tiles at the top (both are
// "direction-of-training" status cards, naturally compact). Body-comp +
// nutrition (WeightTracker + Protein) take full width because their inner
// content is dense. The Hypertrophy Coach is the page centerpiece, full
// width.
export default function GymPage() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Status row — 2-col tile pair */}
      <div className="anim-fade-up h-full"><MesocycleCard /></div>
      <div className="anim-fade-up h-full"><OptimizationCard /></div>

      {/* Composition + nutrition — full width each */}
      <div className="col-span-2 anim-fade-up stagger-1"><WeightTrackerCard /></div>
      <div className="col-span-2 anim-fade-up stagger-2"><ProteinCard /></div>

      {/* The coach — full width, it's the work surface */}
      <div className="col-span-2 anim-fade-up stagger-3"><ProgressiveOverloadCoach /></div>
    </div>
  );
}
