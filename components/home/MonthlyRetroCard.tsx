"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import { PALETTE, TYPE, TINT, BORDER } from "@/lib/design-tokens";

type Retro = {
  id:         string;
  year:       number;
  month:      number;
  summary:    string;
  highlights: string | null;
  lowlights:  string | null;
  next_focus: string | null;
};

// Monthly retrospective surface. Fires the generator on mount during the
// first ~7 days of a new month (idempotent server-side: skips if already
// generated). Surfaces the prior month's retro until Sir dismisses or 7
// days pass.

export default function MonthlyRetroCard() {
  const supabase = createClient();
  const [retro,   setRetro]   = useState<Retro | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      // Try to generate (server gates if already done OR past 7-day window)
      await fetch("/api/jarvis/monthly-retro", { method: "POST" }).catch(() => {});

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setLoading(false); return; }

      const now   = new Date();
      const prior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const { data } = await supabase
        .from("monthly_retros")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", prior.getFullYear())
        .eq("month", prior.getMonth() + 1)
        .is("dismissed_at", null)
        .maybeSingle();

      if (!cancelled) {
        setRetro((data as Retro | null) ?? null);
        setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function dismiss() {
    if (!retro) return;
    setRetro(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("monthly_retros").update({ dismissed_at: new Date().toISOString() }).eq("id", retro.id);
  }

  if (loading || !retro) return null;

  const monthName = new Date(retro.year, retro.month - 1, 1)
    .toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <Card style={{ background: TINT.celebration, border: `1px solid ${BORDER.celebration}` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} style={{ color: PALETTE.celebration }} />
          <span className={TYPE.label} style={{ color: PALETTE.celebration }}>
            {monthName} retro
          </span>
        </div>
        <button onClick={dismiss} className="text-zinc-500 hover:text-zinc-200" aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>

      <p className="text-sm text-zinc-100 leading-relaxed mb-3">{retro.summary}</p>

      {retro.highlights && (
        <div className="mb-2">
          <div className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: PALETTE.success }}>Highlights</div>
          <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-line">{retro.highlights}</p>
        </div>
      )}
      {retro.lowlights && (
        <div className="mb-2">
          <div className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: PALETTE.warning }}>Drift</div>
          <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-line">{retro.lowlights}</p>
        </div>
      )}
      {retro.next_focus && (
        <div className="mt-3 pt-3 border-t border-zinc-800/60">
          <div className={`${TYPE.label} mb-1`}>Next focus</div>
          <p className="text-xs text-zinc-100 leading-relaxed italic">{retro.next_focus}</p>
        </div>
      )}
    </Card>
  );
}
