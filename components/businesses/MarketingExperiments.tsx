"use client";

import { useState } from "react";
import { Plus, X, TrendingUp, Trash2, ExternalLink, FlaskConical } from "lucide-react";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import {
  useMarketingExperiments,
  conversionRate,
  type MarketingExperiment,
} from "@/hooks/useMarketingExperiments";
import { PALETTE, ICON, TYPE } from "@/lib/design-tokens";

// Per-business marketing experiment log. The closed-loop layer that
// turns agent-generated content into actual learning over time:
//   1. Agent (or Sir) drafts a variant → logged here as a draft
//   2. Sir posts it → markPosted bumps posted_at + adds link
//   3. Sir comes back with metrics → updateMetrics fills in the outcome
//   4. Next agent dispatch reads recent experiments + outcomes (via
//      lib/businesses/agent-prompts), grounds new drafts in what's
//      actually converting for Sir's audience
//
// UI is intentionally minimal — friction kills experiment tracking.
// Add + edit + log metrics inline; no separate forms.

const COMMON_CHANNELS = ["twitter", "linkedin", "newsletter", "cold_email", "landing", "instagram", "tiktok", "youtube"];

function fmtCount(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export default function MarketingExperiments({ businessId }: { businessId: string }) {
  const { experiments, addExperiment, updateMetrics, markPosted, archiveExperiment } = useMarketingExperiments(businessId);
  const [adding, setAdding]         = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [variantLabel, setLabel]    = useState("");
  const [variantText, setText]      = useState("");
  const [channel, setChannel]       = useState("twitter");
  const [link, setLink]             = useState("");
  const [busy, setBusy]             = useState(false);

  function resetForm() {
    setLabel(""); setText(""); setChannel("twitter"); setLink(""); setAdding(false);
  }

  async function submit() {
    if (!variantText.trim() || !channel.trim() || busy) return;
    setBusy(true);
    const row = await addExperiment({
      variant_label: variantLabel || `Variant ${experiments.length + 1}`,
      variant_text:  variantText,
      channel,
      link:          link || null,
    });
    setBusy(false);
    if (row) resetForm();
  }

  // Top performer (by conversion rate) — used to anchor the rank.
  const topId = (() => {
    let best: { id: string; rate: number } | null = null;
    for (const e of experiments) {
      const r = conversionRate(e);
      if (r != null && (!best || r > best.rate)) best = { id: e.id, rate: r };
    }
    return best?.id ?? null;
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <FormLabel className="mb-0">Marketing experiments</FormLabel>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-zinc-300 -m-2 p-2 flex items-center gap-1"
          >
            <Plus size={ICON.xs} /> Log
          </button>
        )}
      </div>

      {experiments.length === 0 && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs font-semibold hover:border-zinc-700 hover:text-zinc-300 transition-colors"
        >
          <FlaskConical size={ICON.sm} />
          Log your first experiment
        </button>
      )}

      {experiments.length > 0 && (
        <div className="space-y-1.5">
          {experiments.map((e) => (
            <ExperimentRow
              key={e.id}
              exp={e}
              isTop={e.id === topId}
              isEditing={editingId === e.id}
              onEdit={() => setEditingId(editingId === e.id ? null : e.id)}
              onMetricsChange={(m) => updateMetrics(e.id, m)}
              onMarkPosted={() => markPosted(e.id)}
              onArchive={() => archiveExperiment(e.id)}
            />
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className={TYPE.label}>New experiment</span>
            <button onClick={resetForm} aria-label="Cancel" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2">
              <X size={ICON.sm} />
            </button>
          </div>
          <div className="flex gap-2">
            <FormInput
              value={variantLabel}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Variant label (e.g. Hook A)"
              className="flex-1"
            />
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100"
            >
              {COMMON_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <FormTextarea
            rows={3}
            value={variantText}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the post / subject line / hook / copy you're testing..."
          />
          <FormInput
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="link (optional — if already posted)"
          />
          <Button variant="primary" size="md" fullWidth onClick={submit} loading={busy} disabled={!variantText.trim()}>
            Log experiment
          </Button>
        </div>
      )}
    </div>
  );
}

function ExperimentRow({
  exp, isTop, isEditing, onEdit, onMetricsChange, onMarkPosted, onArchive,
}: {
  exp: MarketingExperiment;
  isTop: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onMetricsChange: (m: { impressions?: number | null; clicks?: number | null; conversions?: number | null; revenue_attributed?: number | null }) => void;
  onMarkPosted: () => void;
  onArchive: () => void;
}) {
  const rate = conversionRate(exp);
  const rateLabel = exp.conversions != null && exp.clicks != null ? "CVR" : (exp.clicks != null && exp.impressions != null ? "CTR" : null);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <button onClick={onEdit} className="w-full text-left px-3 py-2.5">
        <div className="flex items-start gap-2">
          <FlaskConical
            size={ICON.xs}
            className="flex-shrink-0 mt-0.5"
            style={{ color: isTop ? PALETTE.success : PALETTE.dim }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-200 truncate">{exp.variant_label}</span>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500">{exp.channel}</span>
              {isTop && (
                <span className="text-[9px] uppercase tracking-widest font-bold flex items-center gap-1" style={{ color: PALETTE.success }}>
                  <TrendingUp size={ICON.xs} /> top
                </span>
              )}
              {!exp.posted_at && (
                <span className="text-[9px] uppercase tracking-widest text-zinc-600">draft</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug mt-0.5">{exp.variant_text}</p>
            {(exp.impressions != null || exp.clicks != null || exp.conversions != null || exp.revenue_attributed != null) && (
              <div className="flex items-center gap-2.5 text-[10px] text-zinc-500 mt-1 tabular-nums">
                {exp.impressions != null && <span>{fmtCount(exp.impressions)} views</span>}
                {exp.clicks      != null && <span>{fmtCount(exp.clicks)} clicks</span>}
                {exp.conversions != null && <span>{fmtCount(exp.conversions)} conv</span>}
                {exp.revenue_attributed != null && exp.revenue_attributed > 0 && <span style={{ color: PALETTE.success }}>{fmtMoney(exp.revenue_attributed)}</span>}
                {rate != null && rateLabel && <span className="ml-auto font-semibold" style={{ color: PALETTE.celebration }}>{rate}% {rateLabel}</span>}
              </div>
            )}
          </div>
          {exp.link && (
            <a
              href={exp.link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-zinc-600 hover:text-zinc-300 -m-2 p-2 flex-shrink-0"
              aria-label="Open link"
            >
              <ExternalLink size={ICON.xs} />
            </a>
          )}
        </div>
      </button>

      {isEditing && (
        <div className="border-t border-zinc-800 px-3 py-3 space-y-2">
          {!exp.posted_at && (
            <Button variant="secondary" size="sm" fullWidth onClick={onMarkPosted}>
              Mark posted now
            </Button>
          )}
          <FormLabel className="mb-1">Outcomes</FormLabel>
          <div className="grid grid-cols-2 gap-2">
            <MetricField label="Views"        value={exp.impressions}        onSave={(v) => onMetricsChange({ ...currentMetrics(exp), impressions: v })} />
            <MetricField label="Clicks"       value={exp.clicks}             onSave={(v) => onMetricsChange({ ...currentMetrics(exp), clicks:      v })} />
            <MetricField label="Conversions"  value={exp.conversions}        onSave={(v) => onMetricsChange({ ...currentMetrics(exp), conversions: v })} />
            <MetricField label="Revenue $"    value={exp.revenue_attributed} onSave={(v) => onMetricsChange({ ...currentMetrics(exp), revenue_attributed: v })} decimal />
          </div>
          <Button variant="danger" size="sm" fullWidth onClick={() => { if (confirm(`Archive "${exp.variant_label}"?`)) onArchive(); }}>
            <Trash2 size={ICON.xs} /> Archive
          </Button>
        </div>
      )}
    </div>
  );
}

function currentMetrics(e: MarketingExperiment) {
  return {
    impressions:        e.impressions,
    clicks:             e.clicks,
    conversions:        e.conversions,
    revenue_attributed: e.revenue_attributed,
  };
}

function MetricField({
  label, value, onSave, decimal,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
  decimal?: boolean;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  return (
    <div>
      <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</span>
      <FormInput
        type="number"
        inputMode={decimal ? "decimal" : "numeric"}
        step={decimal ? "0.01" : "1"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (trimmed === "") { onSave(null); return; }
          const n = decimal ? parseFloat(trimmed) : parseInt(trimmed, 10);
          if (isFinite(n)) onSave(n);
        }}
        placeholder="—"
        className="text-sm"
      />
    </div>
  );
}
