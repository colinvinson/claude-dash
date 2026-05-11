"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import { X, Plus, ChevronDown, ChevronRight } from "lucide-react";

type Exercise = {
  id: string;
  name: string;
  split_day: string;
  exercise_type: string | null;
  muscle_group: string | null;
};

const SPLITS = ["Push", "Pull", "Legs"];
const TYPES  = ["Compound", "Secondary", "Isolation"];
const MUSCLES = [
  "Chest", "Back", "Shoulders", "Rear Delt", "Triceps", "Biceps",
  "Quads", "Hamstrings", "Glutes", "Calves",
];

export default function ExerciseLibraryEditor() {
  const supabase = createClient();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [openSplit, setOpenSplit] = useState<string | null>("Push");
  const [adding, setAdding]       = useState<string | null>(null);
  const [newName, setNewName]     = useState("");
  const [newType, setNewType]     = useState("Secondary");
  const [newMuscle, setNewMuscle] = useState("Chest");
  const [userId, setUserId]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from("exercises")
      .select("id, name, split_day, exercise_type, muscle_group")
      .eq("user_id", user.id)
      .order("name");
    setExercises((data ?? []) as Exercise[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function addExercise(splitDay: string) {
    if (!userId || !newName.trim()) return;
    await supabase.from("exercises").insert({
      user_id: userId,
      name: newName.trim(),
      split_day: splitDay,
      exercise_type: newType,
      muscle_group: newMuscle,
      muscle_targets: [newMuscle],
    });
    setNewName("");
    setAdding(null);
    await load();
  }

  async function removeExercise(id: string) {
    await supabase.from("exercises").delete().eq("id", id);
    await load();
  }

  if (loading) return null;

  return (
    <Card>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-4">— Exercise Library</span>

      <div className="space-y-2">
        {SPLITS.map((split) => {
          const items = exercises.filter((e) => e.split_day === split);
          const isOpen = openSplit === split;
          return (
            <div key={split} className="border border-zinc-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenSplit(isOpen ? null : split)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                  <span className="text-sm font-semibold text-zinc-100">{split}</span>
                </div>
                <span className="text-[10px] text-zinc-500">{items.length} exercises</span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  {items.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between py-1.5 px-2.5 bg-zinc-900/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-100 truncate">{ex.name}</p>
                        <p className="text-[10px] text-zinc-600">
                          {ex.exercise_type ?? "—"} · {ex.muscle_group ?? "—"}
                        </p>
                      </div>
                      <button onClick={() => removeExercise(ex.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {adding === split ? (
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Exercise name"
                        autoFocus
                        className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-2.5 py-1.5 text-xs outline-none border border-zinc-800 focus:border-zinc-700"
                      />
                      <div className="flex gap-1 flex-wrap">
                        {TYPES.map((t) => (
                          <button
                            key={t}
                            onClick={() => setNewType(t)}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              newType === t ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <select
                        value={newMuscle}
                        onChange={(e) => setNewMuscle(e.target.value)}
                        className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-2.5 py-1.5 text-xs outline-none border border-zinc-800"
                      >
                        {MUSCLES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setAdding(null)}
                          className="flex-1 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-400"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => addExercise(split)}
                          disabled={!newName.trim()}
                          className="flex-1 py-1.5 bg-white text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-xs font-semibold"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAdding(split)}
                      className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus size={11} /> Add exercise
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
