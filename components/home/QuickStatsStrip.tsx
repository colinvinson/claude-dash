type Pill = { label: string; value: string; color?: string };

export default function QuickStatsStrip({ pills }: { pills: Pill[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
      {pills.map((p) => (
        <div
          key={p.label}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{p.label}</span>
          <span
            className="text-[11px] font-semibold"
            style={{ color: p.color ?? "#e4e4e7" }}
          >
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}
