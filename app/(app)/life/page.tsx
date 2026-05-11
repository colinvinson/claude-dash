import GoalmaxxingCard from "@/components/productivity/GoalmaxxingCard";
import LongTermGoalsCard from "@/components/life/LongTermGoalsCard";
import JournalCard from "@/components/life/JournalCard";

export default function LifePage() {
  return (
    <>
      <div className="anim-fade-up"><GoalmaxxingCard /></div>
      <div className="anim-fade-up stagger-2"><LongTermGoalsCard /></div>
      <div className="anim-fade-up stagger-4"><JournalCard /></div>
    </>
  );
}
