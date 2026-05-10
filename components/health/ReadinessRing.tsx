import CircularProgress from "@/components/ui/CircularProgress";

interface Props {
  score: number;
  label: string;
  updatedAt?: string;
  dimmed?: boolean;
}

export default function ReadinessRing({ score, label, updatedAt, dimmed = false }: Props) {
  const color = dimmed ? "#3f3f46"
    : score >= 67 ? "#22c55e"
    : score >= 34 ? "#eab308"
    : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <CircularProgress pct={dimmed ? 0 : score} size={130} strokeWidth={9} color={color} trackColor="#27272a">
        <span className={`text-4xl font-bold leading-none ${dimmed ? "text-zinc-600" : "text-white"}`}>
          {dimmed ? "—" : score}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">Readiness</span>
        {!dimmed && (
          <span className="text-[11px] font-semibold mt-0.5" style={{ color }}>{label}</span>
        )}
      </CircularProgress>
      {updatedAt && !dimmed && (
        <span className="text-[10px] text-zinc-600">Updated {updatedAt}</span>
      )}
    </div>
  );
}
