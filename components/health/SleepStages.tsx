function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Stages { rem: number; deep: number; light: number; awake: number }

export default function SleepStages({ stages }: { stages: Stages }) {
  const total = stages.rem + stages.deep + stages.light + stages.awake;

  const segments = [
    { label: "REM",   min: stages.rem,   color: "#818cf8" },
    { label: "Deep",  min: stages.deep,  color: "#6366f1" },
    { label: "Light", min: stages.light, color: "#a5b4fc" },
    { label: "Awake", min: stages.awake, color: "#3f3f46" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">Sleep Stages</span>
        <span className="text-[10px] text-zinc-500">{fmt(total)} total</span>
      </div>
      {/* Bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.min / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-[10px] text-zinc-400">{fmt(s.min)} {s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
