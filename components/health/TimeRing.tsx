import CircularProgress from "@/components/ui/CircularProgress";

interface Props {
  pct: number;
  label: string;
  sublabel: string;
  timeLeft: string;
  timeRange: string;
}

export default function TimeRing({ pct, label, sublabel, timeLeft, timeRange }: Props) {
  return (
    <div className="flex items-center gap-5">
      <CircularProgress pct={pct} size={110} strokeWidth={8} color="#f97316" trackColor="#27272a">
        <span className="text-3xl font-bold text-white leading-none">{pct}%</span>
        <span className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">{sublabel}</span>
      </CircularProgress>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🔥</span>
          <span className="text-sm font-semibold text-zinc-100">{label}</span>
        </div>
        <span className="text-xs text-zinc-400">{timeLeft} awake time left</span>
        <span className="text-[11px] text-zinc-600">{timeRange}</span>
      </div>
    </div>
  );
}
