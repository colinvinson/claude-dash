"use client";

import { useState } from "react";
import { useStack, StackItem, StackCategory } from "@/hooks/useStack";
import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";
import { Plus, Pill, Syringe, Sparkles, Beaker } from "lucide-react";

const CATEGORY_META: Record<StackCategory, { label: string; Icon: typeof Pill }> = {
  supplement: { label: "Supplements", Icon: Pill },
  medication: { label: "Medications", Icon: Beaker },
  injection:  { label: "Injections",  Icon: Syringe },
  skincare:   { label: "Skincare",    Icon: Sparkles },
};

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

function CategorySection({ category, items, onToggle }: {
  category: StackCategory;
  items: StackItem[];
  onToggle: (id: string, taken: boolean, logId: string | null) => void;
}) {
  if (items.length === 0) return null;
  const taken = items.filter((i) => i.taken).length;
  const meta = CATEGORY_META[category];
  const Icon = meta.Icon;

  // Group by timing within the category
  const morning = items.filter((i) => i.timing === "Morning" || i.timing === "Pre-workout");
  const lunch   = items.filter((i) => i.timing === "Lunch" || i.timing === "Afternoon");
  const evening = items.filter((i) => i.timing === "Evening" || i.timing === "Pre-bed");
  const other   = items.filter((i) => !morning.includes(i) && !lunch.includes(i) && !evening.includes(i));

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">{meta.label}</span>
        </div>
        <span className="text-[11px] text-zinc-500">{taken}/{items.length}</span>
      </div>
      {morning.length > 0 && (
        <div className="mb-2">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1 block">Morning</span>
          {morning.map((item) => <StackRow key={item.id} item={item} onToggle={() => onToggle(item.id, item.taken, item.log_id)} />)}
        </div>
      )}
      {lunch.length > 0 && (
        <div className="mb-2">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1 block">Midday</span>
          {lunch.map((item) => <StackRow key={item.id} item={item} onToggle={() => onToggle(item.id, item.taken, item.log_id)} />)}
        </div>
      )}
      {evening.length > 0 && (
        <div className="mb-2">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1 block">Evening</span>
          {evening.map((item) => <StackRow key={item.id} item={item} onToggle={() => onToggle(item.id, item.taken, item.log_id)} />)}
        </div>
      )}
      {other.length > 0 && other.map((item) => <StackRow key={item.id} item={item} onToggle={() => onToggle(item.id, item.taken, item.log_id)} />)}
    </div>
  );
}

export default function DailyStack({ categories }: { categories?: StackCategory[] }) {
  const { items, loading, toggle, addToStack } = useStack();
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");

  const filterCats: StackCategory[] = categories ?? ["supplement"];
  const visible = items.filter((i) =>
    filterCats.includes(((i as { category?: string }).category ?? "supplement") as StackCategory)
  );

  const total = visible.length;
  const taken = visible.filter((i) => i.taken).length;
  const showWrapper = filterCats.length === 1 && filterCats[0] === "supplement";

  async function handleAdd() {
    if (!newName.trim()) return;
    await addToStack(newName.trim(), newDose.trim(), "Morning");
    setNewName("");
    setNewDose("");
  }

  const content = (
    <Card>
      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-zinc-500">No routine items in these categories. Add some in Settings.</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-400">Tap each as you take it</p>
            <span className="text-[11px] text-zinc-500">{taken}/{total} done · resets 6 AM</span>
          </div>
          {filterCats.map((cat) => {
            const catItems = visible.filter((i) => ((i as { category?: string }).category ?? "supplement") === cat);
            return (
              <CategorySection key={cat} category={cat} items={catItems} onToggle={toggle} />
            );
          })}
        </>
      )}

      {filterCats.includes("supplement") && (
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
      )}
    </Card>
  );

  if (showWrapper) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Daily Stack</SectionLabel>
        </div>
        {content}
      </div>
    );
  }
  return content;
}
