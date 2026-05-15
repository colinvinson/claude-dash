"use client";

import { useMemo } from "react";
import type { StackItem } from "@/hooks/useStack";
import type { StackInsight } from "@/hooks/useStackInsights";
import { AlertTriangle, X, Check } from "lucide-react";

// Schedule timeline — visual style matches the mockup:
//   - Section header per bucket with emoji + clock range
//   - Each row in a soft rounded panel with a big check-circle on the left
//   - Per-row "Running low" pill + "×" archive button on the right
//   - Items with no scheduled clock time fall into the matching bucket via
//     their `timing` string, or into Anytime if unrecognized

type Section = "morning" | "day" | "night" | "anytime";

const TIMING_TO_SECTION: Record<string, Section> = {
  "pre-workout": "morning",
  "morning":     "morning",
  "day":         "day",
  "lunch":       "day",
  "afternoon":   "day",
  "evening":     "night",
  "night":       "night",
  "pre-bed":     "night",
  "bedtime":     "night",
  "anytime":     "anytime",
};

function sectionFromTime(hhmm: string): Section {
  const h = parseInt(hhmm.split(":")[0], 10);
  if (isNaN(h)) return "anytime";
  if (h < 12)  return "morning";
  if (h < 18)  return "day";
  return "night";
}

function sectionFor(item: StackItem): Section {
  if (item.scheduled_at) return sectionFromTime(item.scheduled_at.slice(0, 5));
  const key = (item.timing ?? "").trim().toLowerCase();
  return TIMING_TO_SECTION[key] ?? "anytime";
}

function sortKey(item: StackItem): string {
  if (item.scheduled_at) return `0_${item.scheduled_at}`;
  return `1_${String(item.sort_order).padStart(6, "0")}`;
}

// Categories where "Running low" makes sense — supplies, basically.
const SUPPLY_CATEGORIES = new Set(["supplement", "medication", "injection", "skincare"]);

// Sections + emoji + time hint shown in the header. Strings match the
// reference mockup; underlying bucketing is whatever sectionFor returns.
const SECTION_META: Array<{ key: Section; label: string; emoji: string; range: string }> = [
  { key: "morning", label: "Morning", emoji: "🌅", range: "5–11 AM" },
  { key: "day",     label: "Day",     emoji: "☀️", range: "12–5 PM" },
  { key: "night",   label: "Night",   emoji: "🌙", range: "6 PM+"   },
  { key: "anytime", label: "Anytime", emoji: "✨", range: ""        },
];

function ItemRow({
  item,
  onToggle,
  onEdit,
  onToggleRunningLow,
  onArchive,
}: {
  item: StackItem;
  insight?: StackInsight;
  onToggle: () => void;
  onEdit?: () => void;
  onToggleRunningLow?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const isSupply = SUPPLY_CATEGORIES.has(item.category);
  const canShowRunningLow = isSupply && onToggleRunningLow;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all ${
        item.taken
          ? "bg-emerald-500/5 border-emerald-500/15"
          : "bg-zinc-900/40 border-zinc-800/60"
      }`}
    >
      {/* Big check-circle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={item.taken ? "Mark not done" : "Mark done"}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
        style={
          item.taken
            ? { background: "#10b981", border: "2px solid #10b981" }
            : { background: "transparent", border: "2px solid #3f3f46" }
        }
      >
        {item.taken && <Check size={16} strokeWidth={3} className="text-white" />}
      </button>

      {/* Title + subtitle (tap to edit) */}
      <button onClick={onEdit} className="flex-1 min-w-0 text-left" aria-label="Edit item">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold truncate ${item.taken ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
            {item.name}
          </span>
          {item.is_running_low && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-px">
              not ordered
            </span>
          )}
        </div>
        {(item.dose || item.notes) && (
          <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
            {[item.dose, item.notes].filter(Boolean).join(" · ")}
          </div>
        )}
      </button>

      {/* Running low pill (supplies only) */}
      {canShowRunningLow && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleRunningLow!(item.id); }}
          className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
            item.is_running_low
              ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
              : "bg-transparent border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          }`}
          aria-label={item.is_running_low ? "Clear running-low" : "Mark running low"}
        >
          <AlertTriangle size={10} />
          <span>Running low</span>
        </button>
      )}

      {/* Archive */}
      {onArchive && (
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(item.id); }}
          aria-label="Remove from stack"
          className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default function TimelineSchedule({
  items,
  insights,
  onToggle,
  onEdit,
  onToggleRunningLow,
  onArchive,
}: {
  items: StackItem[];
  insights?: Record<string, StackInsight>;
  onToggle: (id: string, taken: boolean, logId: string | null) => void;
  onEdit?: (item: StackItem) => void;
  onToggleRunningLow?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const buckets: Record<Section, StackItem[]> = { morning: [], day: [], night: [], anytime: [] };
    for (const item of items) buckets[sectionFor(item)].push(item);
    for (const k of Object.keys(buckets) as Section[]) {
      buckets[k].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    }
    return buckets;
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="text-xs text-zinc-500 py-6 text-center">
        No items yet. Add one below to start building your stack.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {SECTION_META.map(({ key, label, emoji, range }) => {
        const sectionItems = grouped[key];
        if (sectionItems.length === 0) return null;
        return (
          <div key={key}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-base">{emoji}</span>
              <span className="text-sm font-semibold text-zinc-200">{label}</span>
              {range && <span className="text-[11px] text-zinc-500">{range}</span>}
            </div>
            <div className="flex flex-col gap-2">
              {sectionItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  insight={insights?.[item.id]}
                  onToggle={() => onToggle(item.id, item.taken, item.log_id)}
                  onEdit={onEdit ? () => onEdit(item) : undefined}
                  onToggleRunningLow={onToggleRunningLow}
                  onArchive={onArchive}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
