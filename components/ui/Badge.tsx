const variants = {
  green:  "bg-green-500/15 text-green-400 border border-green-500/20",
  orange: "bg-orange-500/15 text-orange-400 border border-orange-500/20",
  red:    "bg-red-500/15 text-red-400 border border-red-500/20",
  blue:   "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  zinc:   "bg-zinc-800 text-zinc-400 border border-zinc-700",
  yellow: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
};

type Variant = keyof typeof variants;

export default function Badge({ children, variant = "zinc" }: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded ${variants[variant]}`}>
      {children}
    </span>
  );
}
