"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import { TYPE, PALETTE } from "@/lib/design-tokens";
import { Brain, Heart, Users, BookOpen, Sun, Coffee, DollarSign, Camera, Activity, Plus } from "lucide-react";

// Beyond the body — surfaces the 9 dimension trackers that previously only
// lived inside the LogSheet. Each tile shows a 7-day total + a tiny streak
// dot row so Sir can glance and see what's been touched vs neglected.
//
// Tap a tile → opens the global + LogSheet. Mission alignment: tracking
// without surfacing is invisible data. This card is the surface.

type DimRow = { log_date: string };

type Dim = {
  key:    string;
  label:  string;
  icon:   typeof Brain;
  color:  string;
  unit?:  string;
};

const DIMS: Dim[] = [
  { key: "focus_sessions",  label: "Focus",     icon: Brain,       color: "#a78bfa", unit: "min" },
  { key: "cardio_logs",     label: "Cardio",    icon: Activity,    color: "#0ea5e9", unit: "min" },
  { key: "social_logs",     label: "Social",    icon: Users,       color: "#60a5fa" },
  { key: "libido_logs",     label: "Libido",    icon: Heart,       color: "#fb7185" },
  { key: "aesthetic_logs",  label: "Aesthetic", icon: Camera,      color: "#fbbf24" },
  { key: "sun_logs",        label: "Sun",       icon: Sun,         color: "#f59e0b", unit: "min" },
  { key: "caffeine_logs",   label: "Caffeine",  icon: Coffee,      color: "#a8a29e", unit: "mg" },
  { key: "learning_logs",   label: "Learning",  icon: BookOpen,    color: "#34d399", unit: "min" },
  { key: "money_logs",      label: "Money",     icon: DollarSign,  color: "#22c55e" },
];

const SUM_FIELDS: Record<string, string | null> = {
  focus_sessions: "duration_min",
  cardio_logs:    "duration_min",
  social_logs:    null,           // count entries
  libido_logs:    null,           // count entries (latest is what matters)
  aesthetic_logs: null,           // count entries
  sun_logs:       "duration_min",
  caffeine_logs:  "mg",
  learning_logs:  "duration_min",
  money_logs:     null,           // count entries (net is computed separately if needed)
};

type Snapshot = Record<string, { total: number; daysActive: number; daysSet: Set<string> }>;

export default function DimensionsCard({ onOpenLog }: { onOpenLog?: () => void }) {
  const supabase = createClient();
  const [snap, setSnap]       = useState<Snapshot>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setLoading(false); return; }
      const since = new Date(); since.setDate(since.getDate() - 7);
      const sinceStr = since.toISOString().slice(0, 10);

      const results: Snapshot = {};
      // Fetch each dimension's 7d window in parallel
      await Promise.all(DIMS.map(async (d) => {
        const sumField = SUM_FIELDS[d.key];
        const cols = sumField ? `log_date, ${sumField}` : "log_date";
        const { data } = await supabase
          .from(d.key)
          .select(cols)
          .eq("user_id", user.id)
          .gte("log_date", sinceStr);
        const rows = (data ?? []) as unknown as Array<DimRow & Record<string, unknown>>;
        const daysSet = new Set(rows.map((r) => r.log_date));
        const total = sumField
          ? rows.reduce((s, r) => s + (Number(r[sumField]) || 0), 0)
          : rows.length;
        results[d.key] = { total, daysActive: daysSet.size, daysSet };
      }));

      if (!cancelled) {
        setSnap(results);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;

  // Build the 7-day dot row dates (oldest to newest)
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className={TYPE.label}>— Beyond the body · 7d</span>
        {onOpenLog && (
          <button
            onClick={onOpenLog}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-200"
          >
            <Plus size={10} /> Log
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {DIMS.map((d) => {
          const stats = snap[d.key] ?? { total: 0, daysActive: 0, daysSet: new Set<string>() };
          const empty = stats.total === 0;
          return (
            <div
              key={d.key}
              className="rounded-lg p-2.5 transition-colors"
              style={{
                background: empty ? "rgba(255,255,255,0.02)" : `${d.color}0d`,
                border: `1px solid ${empty ? "rgba(255,255,255,0.04)" : `${d.color}33`}`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <d.icon size={11} style={{ color: empty ? PALETTE.dim : d.color }} />
                <span className="text-[10px] text-zinc-500 truncate">{d.label}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span
                  className="text-base font-bold tabular-nums"
                  style={{ color: empty ? PALETTE.dim : d.color }}
                >
                  {empty ? "—" : (d.unit === "mg" ? Math.round(stats.total).toLocaleString() : Math.round(stats.total))}
                </span>
                {d.unit && !empty && <span className="text-[9px] text-zinc-600">{d.unit}</span>}
              </div>
              {/* 7-day streak dots */}
              <div className="flex items-center gap-0.5">
                {days.map((day, i) => {
                  const active = stats.daysSet.has(day);
                  return (
                    <span
                      key={i}
                      className="flex-1 h-1 rounded-full"
                      style={{
                        background: active ? d.color : "rgba(255,255,255,0.05)",
                        opacity: active ? 0.8 : 1,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
