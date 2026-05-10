import Card from "@/components/ui/Card";

export default function StreakAlert({ streak }: { streak: number }) {
  return (
    <Card style={{ border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)" }}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-sm font-semibold text-red-400">
            {streak}-day streak at risk
          </p>
          <p className="text-[11px] text-zinc-500">Complete a goal before midnight to keep it alive.</p>
        </div>
      </div>
    </Card>
  );
}
