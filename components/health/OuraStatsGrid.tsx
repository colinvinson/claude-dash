interface Stat { label: string; value: string; unit?: string; color?: string }

function StatBox({ label, value, unit, color = "text-white" }: Stat) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {unit && <span className="text-xs text-zinc-500">{unit}</span>}
      </div>
    </div>
  );
}

interface Props {
  sleep: number;
  activityScore: number;
  hrv: number;
  rhr: number;
  spo2: number;
  respRate: number;
}

export default function OuraStatsGrid({ sleep, activityScore, hrv, rhr, spo2, respRate }: Props) {
  const actColor = activityScore >= 67 ? "text-green-400" : activityScore >= 34 ? "text-yellow-400" : "text-orange-400";

  return (
    <div className="grid grid-cols-3 gap-4 pt-2">
      <StatBox label="Sleep" value={`${sleep}%`} />
      <StatBox label="Activity" value={String(activityScore)} color={actColor} />
      <StatBox label="HRV" value={String(hrv)} unit="ms" />
      <StatBox label="RHR" value={String(rhr)} unit="bpm" />
      <StatBox label="SpO₂" value={`${spo2}%`} />
      <StatBox label="Resp Rate" value={String(respRate)} unit="br/min" />
    </div>
  );
}
