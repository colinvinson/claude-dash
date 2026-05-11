"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useLog } from "@/hooks/useLog";
import ProteinTile from "@/components/protein/ProteinTile";

const DRINK_TYPES = ["Beer", "Wine", "Spirits", "Cocktail"];
const MOOD_EMOJIS = ["😞", "😐", "🙂", "😊", "🤩"];
const MED_DURATIONS = [5, 10, 15, 20, 30];

export default function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addWater, logMeditation, logAlcohol, updateFaith, logMood, logWeight, brainDump } = useLog();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Local state for inputs
  const [drinkType, setDrinkType] = useState("Beer");
  const [drinkCount, setDrinkCount] = useState(1);
  const [bibleMin, setBibleMin] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [dumpText, setDumpText] = useState("");
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl overflow-y-auto"
        style={{
          maxHeight: "85vh",
          background: "rgba(10,10,12,0.97)",
          backdropFilter: "blur(32px) saturate(1.2)",
          WebkitBackdropFilter: "blur(32px) saturate(1.2)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-[13px] font-semibold uppercase tracking-widest text-zinc-300">Log</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-8 space-y-2">
          {/* Water */}
          <LogTile
            emoji="💧"
            label="Water"
            meta={`${state.water} glasses`}
            expanded={expanded === "water"}
            onToggle={() => toggle("water")}
          >
            <div className="flex items-center gap-3 pt-2">
              <span className="text-2xl font-bold text-white tabular-nums">{state.water}</span>
              <span className="text-sm text-zinc-500">glasses today</span>
              <button
                onClick={() => handle("water", addWater)}
                className="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ background: "rgba(59,130,246,0.3)", border: "1px solid rgba(59,130,246,0.3)" }}
              >
                {saving === "water" ? "..." : saved === "water" ? "✓" : "+1"}
              </button>
            </div>
          </LogTile>

          {/* Protein */}
          <ProteinTile
            expanded={expanded === "protein"}
            onToggle={() => toggle("protein")}
          />

          {/* Meditation */}
          <LogTile
            emoji="🧘"
            label="Meditation"
            meta={state.meditation > 0 ? `${state.meditation} min` : "none today"}
            expanded={expanded === "meditation"}
            onToggle={() => toggle("meditation")}
          >
            <div className="flex gap-2 pt-2 flex-wrap">
              {MED_DURATIONS.map((min) => (
                <button
                  key={min}
                  onClick={() => handle(`med-${min}`, () => logMeditation(min))}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                  style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                >
                  {saved === `med-${min}` ? "✓" : `${min}m`}
                </button>
              ))}
            </div>
          </LogTile>

          {/* Alcohol */}
          <LogTile
            emoji="🍺"
            label="Alcohol"
            meta={state.alcoholCount > 0 ? `${state.alcoholCount} drinks` : "none logged"}
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

          {/* Prayer */}
          <LogTile
            emoji="🙏"
            label="Prayer"
            meta={state.faith.prayed ? "Done today ✓" : "Not yet"}
            expanded={expanded === "prayer"}
            onToggle={() => toggle("prayer")}
          >
            <div className="pt-2">
              <button
                onClick={() => handle("prayer", () => updateFaith({ prayed: !state.faith.prayed }))}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: state.faith.prayed ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)",
                  color: state.faith.prayed ? "#34d399" : "#a1a1aa",
                  border: `1px solid ${state.faith.prayed ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {state.faith.prayed ? "✓ Prayed today" : "Mark as prayed"}
              </button>
            </div>
          </LogTile>

          {/* Bible */}
          <LogTile
            emoji="📖"
            label="Bible"
            meta={state.faith.bible_min > 0 ? `${state.faith.bible_min} min read` : "none today"}
            expanded={expanded === "bible"}
            onToggle={() => toggle("bible")}
          >
            <div className="flex items-center gap-3 pt-2">
              <input
                type="number"
                placeholder="minutes"
                value={bibleMin}
                onChange={(e) => setBibleMin(e.target.value)}
                className="w-24 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none"
              />
              <button
                onClick={() => {
                  const min = parseInt(bibleMin, 10);
                  if (min > 0) {
                    handle("bible", () => updateFaith({ bible_min: (state.faith.bible_min || 0) + min }));
                    setBibleMin("");
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.2)" }}
              >
                {saving === "bible" ? "..." : saved === "bible" ? "✓" : "Log"}
              </button>
            </div>
          </LogTile>

          {/* Church */}
          <LogTile
            emoji="⛪"
            label="Church"
            meta={state.faith.church_attended ? "Attended ✓" : "Not logged"}
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

          {/* Mood */}
          <LogTile
            emoji="😊"
            label="Mood"
            meta={state.mood ? `${MOOD_EMOJIS[state.mood - 1]} ${state.mood}/5` : "not logged"}
            expanded={expanded === "mood"}
            onToggle={() => toggle("mood")}
          >
            <div className="flex gap-3 pt-2">
              {MOOD_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => handle("mood", () => logMood(i + 1))}
                  className="flex-1 py-2 rounded-lg text-xl transition-transform hover:scale-110"
                  style={{
                    background: state.mood === i + 1 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {emoji}
                </button>
              ))}
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

          {/* Brain Dump */}
          <LogTile
            emoji="✏️"
            label="Brain Dump"
            meta="thoughts, ideas, goals"
            expanded={expanded === "dump"}
            onToggle={() => toggle("dump")}
          >
            <div className="pt-2 space-y-2">
              <textarea
                value={dumpText}
                onChange={(e) => setDumpText(e.target.value)}
                placeholder="Dump anything here — ideas, feelings, tasks, goals..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none resize-none placeholder-zinc-600"
              />
              <button
                disabled={!dumpText.trim()}
                onClick={async () => {
                  if (!dumpText.trim()) return;
                  setSaving("dump");
                  await brainDump(dumpText.trim());
                  setDumpText("");
                  setSaving(null);
                  setSaved("dump");
                  setTimeout(() => setSaved(null), 1500);
                }}
                className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.08)", color: "#e4e4e7" }}
              >
                {saving === "dump" ? "Saving..." : saved === "dump" ? "✓ Saved to journal" : "Save to Journal"}
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
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-xl w-7 text-center">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-zinc-200">{label}</div>
          <div className="text-[10px] text-zinc-500 truncate">{meta}</div>
        </div>
        <span
          className="text-zinc-600 transition-transform duration-200 text-xs"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >▼</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
