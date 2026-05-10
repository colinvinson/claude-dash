export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-zinc-600 text-xs">—</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {children}
      </span>
    </div>
  );
}
