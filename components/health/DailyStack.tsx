"use client";

import { useState } from "react";
import { useStack, StackItem } from "@/hooks/useStack";
import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";
import { Plus } from "lucide-react";

function StackRow({ item, onToggle }: { item: StackItem; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-start gap-3 w-full text-left py-2.5 border-b border-[#1f1f1f]/60 last:border-0 group"
    >
      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
        item.taken ? "bg-green-500 border-green-500" : "border-zinc-600 group-hover:border-zinc-400"
      }`}>
        {item.taken && (
          <svg viewBox="0 0 10 8" className="w-3 h-2.5" fill="none" stroke="white" strokeWidth="2">
            <path d="M1 4l2.5 2.5L9 1" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${item.taken ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
          {item.name}
        </span>
        {item.notes && (
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{item.notes}</p>
        )}
      </div>
      <span className="text-[11px] text-zinc-600 whitespace-nowrap mt-0.5">{item.dose}</span>
    </button>
  );
}

function TimingSection({ label, time, items, onToggle }: {
  label: string; time: string; items: StackItem[];
  onToggle: (id: string, taken: boolean, logId: string | null) => void;
}) {
  const taken = items.filter((i) => i.taken).length;
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 mb-1 pb-1 border-b border-[#1f1f1f]">
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
        <span className="text-[11px] text-zinc-600">{time}</span>
        <span className="ml-auto text-[11px] text-zinc-500">{taken}/{items.length}</span>
      </div>
      {items.map((item) => (
        <StackRow key={item.id} item={item} onToggle={() => onToggle(item.id, item.taken, item.log_id)} />
      ))}
    </div>
  );
}

export default function DailyStack() {
  const { items, loading, toggle, addToStack } = useStack();
  const [newName,   setNewName]   = useState("");
  const [newDose,   setNewDose]   = useState("");

  const morning = items.filter((i) => i.timing === "Morning");
  const lunch   = items.filter((i) => i.timing === "Lunch");
  const evening = items.filter((i) => i.timing === "Evening");
  const total   = items.length;
  const taken   = items.filter((i) => i.taken).length;

  async function handleAdd() {
    if (!newName.trim()) return;
    await addToStack(newName.trim(), newDose.trim(), "Morning");
    setNewName("");
    setNewDose("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Daily Stack</SectionLabel>
        <span className="text-[11px] text-zinc-500">{taken}/{total} taken · resets 6 AM</span>
      </div>
      <Card>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />)}</div>
        ) : (
          <>
            <p className="text-xs text-zinc-400 mb-3">Tap each as you take it</p>
            {morning.length > 0 && <TimingSection label="Morning" time="7–10 AM" items={morning} onToggle={toggle} />}
            {lunch.length   > 0 && <TimingSection label="Lunch"   time="12–2 PM" items={lunch}   onToggle={toggle} />}
            {evening.length > 0 && <TimingSection label="Evening" time="9–11 PM"  items={evening} onToggle={toggle} />}
          </>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1f1f1f]">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (e.g. B-complex)"
            className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600" />
          <input value={newDose} onChange={(e) => setNewDose(e.target.value)} placeholder="Dose"
            className="w-24 bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600" />
          <button onClick={handleAdd}
            className="flex items-center gap-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs font-semibold text-zinc-100 transition-colors">
            <Plus size={12} /> Add
          </button>
        </div>
      </Card>
    </div>
  );
}
