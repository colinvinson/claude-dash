"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import { X, Plus } from "lucide-react";

type Template = { id: string; title: string; priority: number; is_active: boolean };

export default function GoalTemplatesEditor() {
  const supabase = createClient();
  const [items, setItems]   = useState<Template[]>([]);
  const [title, setTitle]   = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from("goal_templates")
      .select("id, title, priority, is_active")
      .eq("user_id", user.id)
      .order("sort_order");
    setItems((data ?? []) as Template[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function add() {
    if (!userId || !title.trim()) return;
    await supabase.from("goal_templates").insert({
      user_id: userId,
      title: title.trim(),
      priority: 1,
      is_active: true,
      sort_order: items.length,
    });
    setTitle("");
    await load();
  }

  async function remove(id: string) {
    await supabase.from("goal_templates").delete().eq("id", id);
    await load();
  }

  if (loading) return null;

  return (
    <Card>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">— Recurring goals</span>
      <p className="text-[10px] text-zinc-600 mb-4">Auto-added to your daily goal list each morning.</p>

      {items.length === 0 ? (
        <p className="text-xs text-zinc-500 mb-4">No recurring goals yet.</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {items.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded-xl">
              <span className="text-sm text-zinc-100">{t.title}</span>
              <button onClick={() => remove(t.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-zinc-800">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Take Concerta"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
        />
        <button
          onClick={add}
          disabled={!title.trim()}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-zinc-100 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    </Card>
  );
}
