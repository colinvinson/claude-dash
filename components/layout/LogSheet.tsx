"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useLog } from "@/hooks/useLog";

const DRINK_TYPES = ["Beer", "Wine", "Spirits", "Cocktail"];

export default function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, logAlcohol, updateFaith, logWeight } = useLog();
  const [expanded, setExpanded] = useState<string | null>(null);

  const [drinkType, setDrinkType] = useState("Beer");
  const [drinkCount, setDrinkCount] = useState(1);
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function toggle(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  async function handle(key: string, fn: () => Promise<void>) {
    setSaving(key);
    await fn();
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 1500);
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 anim-fade" onClick={onClose} />

      <div
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl overflow-y-auto anim-sheet"
        style={{
          maxHeight: "85vh",
          background: "rgba(10,10,12,0.97)",
          backdropFilter: "blur(32px) saturate(1.2)",
          WebkitBackdropFilter: "blur(32px) saturate(1.2)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-zinc-700" />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold uppercase tracking-widest text-zinc-300">Log</span>
            <span className="text-[10px] text-zinc-600">For one-off / non-daily events</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-8 space-y-2">
          {/* Alcohol */}
          <LogTile
            emoji="🍺"
            label="Alcohol"
            meta={state.alcoholCount > 0 ? `${state.alcoholCount} drinks today` : "none logged"}
            expanded={expanded === "alcohol"}
            onToggle={() => toggle("alcohol")}
          >
            <div className="pt-2 space-y-3">
              <div className="flex gap-2 flex-wrap">
                {DRINK_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDrinkType(t)}
                    className="px-3 py-1 rounded-lg text-[11px] font-medium transition-colors"
                    style={{
                      background: drinkType === t ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)",
                      color: drinkType === t ? "#fbbf24" : "#71717a",
                      border: `1px solid ${drinkType === t ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDrinkCount((n) => Math.max(1, n - 1))}
                  className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >−</button>
                <span className="text-xl font-bold text-white w-6 text-center">{drinkCount}</span>
                <button
                  onClick={() => setDrinkCount((n) => n + 1)}
                  className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >+</button>
                <button
                  onClick={() => handle("alcohol", () => logAlcohol(drinkType, drinkCount))}
                  className="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "rgba(251,191,36,0.25)", border: "1px solid rgba(251,191,36,0.2)" }}
                >
                  {saving === "alcohol" ? "..." : saved === "alcohol" ? "✓ Logged" : "Log"}
                </button>
              </div>
            </div>
          </LogTile>

          {/* Weight */}
          <LogTile
            emoji="⚖️"
            label="Weight"
            meta={state.weight ? `${state.weight} kg` : "not logged"}
            expanded={expanded === "weight"}
            onToggle={() => toggle("weight")}
          >
            <div className="flex items-center gap-3 pt-2">
              <input
                type="number"
                step="0.1"
                placeholder="kg"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-24 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none"
              />
              <button
                onClick={() => {
                  const kg = parseFloat(weightInput);
                  if (kg > 0) {
                    handle("weight", () => logWeight(kg));
                    setWeightInput("");
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "rgba(59,130,246,0.25)", border: "1px solid rgba(59,130,246,0.2)" }}
              >
                {saving === "weight" ? "..." : saved === "weight" ? "✓" : "Log"}
              </button>
            </div>
          </LogTile>

          {/* Church */}
          <LogTile
            emoji="⛪"
            label="Church"
            meta={state.faith.church_attended ? "Attended ✓" : "Not logged today"}
            expanded={expanded === "church"}
            onToggle={() => toggle("church")}
          >
            <div className="pt-2">
              <button
                onClick={() => handle("church", () => updateFaith({ church_attended: !state.faith.church_attended }))}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: state.faith.church_attended ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)",
                  color: state.faith.church_attended ? "#34d399" : "#a1a1aa",
                  border: `1px solid ${state.faith.church_attended ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {state.faith.church_attended ? "✓ Attended" : "Mark attended"}
              </button>
            </div>
          </LogTile>
        </div>
      </div>
    </>
  );
}

function LogTile({
  emoji, label, meta, expanded, onToggle, children,
}: {
  emoji: string;
  label: string;
  meta: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{emoji}</span>
          <div>
            <p className="text-sm font-medium text-zinc-100">{label}</p>
            <p className="text-[11px] text-zinc-500">{meta}</p>
          </div>
        </div>
        <span className="text-zinc-600 text-xs">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
