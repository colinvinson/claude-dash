import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";

export default function SearchPage() {
  return (
    <div>
      <SectionLabel>Search</SectionLabel>
      <Card>
        <input placeholder="Search goals, workouts, supplements..." className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none" />
      </Card>
    </div>
  );
}
