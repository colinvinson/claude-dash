"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import { X, Plus } from "lucide-react";

type Category = "supplement" | "medication" | "injection" | "skincare";

type Stack = {
  id: string;
  name: string;
  dose: string | null;
  timing: string | null;
  category: Category;
  is_active: boolean;
};

const CATEGORY_LABEL: Record<Category, string> = {
  supplement: "Supplement",
  medication: "Medication",
  injection:  "Injection",
  skincare:   "Skincare",
};

const TIMING_OPTIONS = ["Morning", "Pre-workout", "Lunch", "Afternoon", "Evening", "Pre-bed"];

export default function SupplementStackEditor() {
  const supabase = createClient();
  const [items, setItems]   = useState<Stack[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [name, setName]       = useState("");
  const [dose, setDose]       = useState("");
  const [timing, setTiming]   = useState("Morning");
  const [category, setCategory] = useState<Category>("supplement");
  const [userId, setUserId]   = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from("supplement_stack")
      .select("id, name, dose, timing, category, is_active")
      .eq("user_id", user.id)
      .order("sort_order");
    setItems((data ?? []) as Stack[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function addItem() {
    if (!userId || !name.trim()) return;
    setAdding(true);
    await supabase.from("supplement_stack").insert({
      user_id: userId,
      name: name.trim(),
      dose: dose.trim() || null,
      timing,
      category,
      is_active: true,
      sort_order: items.length,
    });
    setName(""); setDose("");
    setAdding(false);
    await load();
  }

  async function archive(id: string) {
    await supabase.from("supplement_stack").update({ is_active: false }).eq("id", id);
    await load();
  }

  if (loading) return null;

  return (
    <Card>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-4">— Routine items (supplements / meds / injections / skincare)</span>

      {items.length === 0 ? (
        <p className="text-xs text-zinc-500 mb-4">No routine items yet. Add one below.</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {items.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between py-2 px-3 rounded-xl ${s.is_active ? "bg-zinc-800/50" : "bg-zinc-900 opacity-50"}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100 truncate">{s.name}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  <span className="text-zinc-400">{CATEGORY_LABEL[s.category ?? "supplement"]}</span>
                  {s.dose && <span> · {s.dose}</span>}
                  {s.timing && <span> · {s.timing}</span>}
                  {!s.is_active && <span> · archived</span>}
                </p>
              </div>
              {s.is_active && (
                <button
                  onClick={() => archive(s.id)}
                  className="ml-3 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 pt-3 border-t border-zinc-800">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">Add supplement</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Magnesium Glycinate)"
          className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
        />
        <input
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder="Dose (e.g. 400mg)"
          className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
        />
        <div>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Category</span>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  category === c ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TIMING_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => setTiming(t)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                timing === t ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={addItem}
          disabled={adding || !name.trim()}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-zinc-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus size={14} />
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
    </Card>
  );
}
