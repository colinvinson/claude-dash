"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import { X, Plus } from "lucide-react";

type Gym = { id: string; name: string };

export default function GymEditor() {
  const supabase = createClient();
  const [gyms, setGyms]     = useState<Gym[]>([]);
  const [name, setName]     = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase.from("gym_locations").select("id, name").eq("user_id", user.id).order("created_at");
    setGyms((data ?? []) as Gym[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function addGym() {
    if (!userId || !name.trim()) return;
    await supabase.from("gym_locations").insert({ user_id: userId, name: name.trim() });
    setName("");
    await load();
  }

  async function removeGym(id: string) {
    await supabase.from("gym_locations").delete().eq("id", id);
    await load();
  }

  if (loading) return null;

  return (
    <Card>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-4">— Gym Locations</span>

      {gyms.length === 0 ? (
        <p className="text-xs text-zinc-500 mb-4">No gyms yet.</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {gyms.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded-xl">
              <span className="text-sm text-zinc-100">{g.name}</span>
              <button onClick={() => removeGym(g.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-zinc-800">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add gym name"
          onKeyDown={(e) => e.key === "Enter" && addGym()}
          className="flex-1 bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
        />
        <button
          onClick={addGym}
          disabled={!name.trim()}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-zinc-100 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    </Card>
  );
}
