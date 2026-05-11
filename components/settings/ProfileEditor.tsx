"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import Card from "@/components/ui/Card";

const TRAINING_GOALS = ["hypertrophy", "lean muscle", "strength", "general fitness"];

export default function ProfileEditor() {
  const { profile, latestWeight, saveProfile, logWeight } = useSettings();
  const [name, setName]               = useState("");
  const [goalKg, setGoalKg]           = useState("");
  const [trainingGoal, setTrainingGoal] = useState("lean muscle");
  const [currentKg, setCurrentKg]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [savedKey, setSavedKey]       = useState<string | null>(null);

  useEffect(() => {
    setName(profile.full_name ?? "");
    setGoalKg(profile.goal_weight_kg?.toString() ?? "");
    setTrainingGoal(profile.training_goal ?? "lean muscle");
  }, [profile]);

  async function saveProfileFields() {
    setSaving(true);
    await saveProfile({
      full_name:      name.trim() || null,
      goal_weight_kg: goalKg ? Number(goalKg) : null,
      training_goal:  trainingGoal,
    });
    setSaving(false);
    setSavedKey("profile");
    setTimeout(() => setSavedKey(null), 1500);
  }

  async function saveCurrentWeight() {
    const kg = Number(currentKg);
    if (!kg || kg <= 0) return;
    setSaving(true);
    await logWeight(kg);
    setSaving(false);
    setCurrentKg("");
    setSavedKey("weight");
    setTimeout(() => setSavedKey(null), 1500);
  }

  return (
    <Card>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-4">— Profile</span>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="optional"
            className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">Goal weight (kg)</label>
          <input
            type="number"
            inputMode="decimal"
            value={goalKg}
            onChange={(e) => setGoalKg(e.target.value)}
            placeholder="e.g. 75"
            className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">Training goal</label>
          <div className="flex gap-1.5 flex-wrap">
            {TRAINING_GOALS.map((g) => (
              <button
                key={g}
                onClick={() => setTrainingGoal(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  trainingGoal === g
                    ? "bg-white text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={saveProfileFields}
          disabled={saving}
          className="w-full py-2.5 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 rounded-xl text-sm font-bold text-zinc-900 disabled:text-zinc-600 transition-colors"
        >
          {savedKey === "profile" ? "✓ Saved" : saving ? "Saving…" : "Save profile"}
        </button>
      </div>

      <div className="mt-5 pt-5 border-t border-zinc-800">
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
          Current weight {latestWeight && <span className="text-zinc-600 normal-case tracking-normal">— last: {latestWeight}kg</span>}
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={currentKg}
            onChange={(e) => setCurrentKg(e.target.value)}
            placeholder="kg"
            className="flex-1 bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
          />
          <button
            onClick={saveCurrentWeight}
            disabled={saving || !currentKg}
            className="px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 rounded-xl text-sm font-bold text-white disabled:text-zinc-600 transition-colors"
          >
            {savedKey === "weight" ? "✓" : "Log"}
          </button>
        </div>
      </div>
    </Card>
  );
}
