"use client";

import { useEffect, useState } from "react";
import { X, Archive, Trash2, TrendingUp, Plus } from "lucide-react";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { useBusinesses, type Business, type BusinessStatus } from "@/hooks/useBusinesses";
import { useBusinessRevenue } from "@/hooks/useBusinessRevenue";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";
import BusinessAgents from "./BusinessAgents";
import BusinessTasks from "./BusinessTasks";
import BusinessActivity from "./BusinessActivity";
import MRRSparkline from "./MRRSparkline";

// Per-business control panel. Layout flows top-down by what Sir needs to
// SEE first vs ACT on first vs reference occasionally:
//
//   1. HERO       — name (inline edit) + stage chip + MRR + sparkline + MoM%
//   2. LOG REV    — one-row "log this month's revenue" inline (collapsed
//                   into a button so it doesn't dominate)
//   3. TASKS      — the main work surface
//   4. AGENTS     — workforce with inline artifact feedback
//   5. ACTIVITY   — chronological feed of revenue / agents / artifacts / tasks
//   6. STATS      — collapsed: revenue history table, customers
//   7. NOTES      — collapsed: free-form notes
//   8. ARCHIVE    — danger zone at the bottom

const STATUSES: BusinessStatus[] = ["idea", "building", "live", "growing", "paused"];

const STATUS_COLOR: Record<BusinessStatus, string> = {
  idea:     PALETTE.dim,
  building: PALETTE.info,
  live:     PALETTE.success,
  growing:  PALETTE.success,
  paused:   PALETTE.warning,
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export default function BusinessDetail({
  business,
  onClose,
}: {
  business: Business;
  onClose: () => void;
}) {
  const { updateBusiness, archiveBusiness } = useBusinesses();
  const { logs, momPct, logRevenue, deleteRevenue } = useBusinessRevenue(business.id);

  // Local mirrors — debounce-free, push on blur / button tap.
  const [name, setName]             = useState(business.name);
  const [status, setStatus]         = useState<BusinessStatus>(business.status);
  const [category, setCategory]     = useState(business.category ?? "");
  const [customers, setCustomers]   = useState(String(business.customer_count));
  const [notes, setNotes]           = useState(business.notes ?? "");
  const [newAmount, setNewAmount]   = useState("");
  const [newNote, setNewNote]       = useState("");
  const [revOpen, setRevOpen]       = useState(false);

  // Reset local state when the displayed business changes (parent reuses
  // the same sheet for different rows).
  useEffect(() => {
    setName(business.name);
    setStatus(business.status);
    setCategory(business.category ?? "");
    setCustomers(String(business.customer_count));
    setNotes(business.notes ?? "");
  }, [business]);

  async function saveField<K extends keyof Business>(field: K, value: Business[K]) {
    await updateBusiness(business.id, { [field]: value } as Partial<Business>);
  }

  async function submitRevenue() {
    const amt = parseFloat(newAmount);
    if (!isFinite(amt) || amt < 0) return;
    await logRevenue(amt, newNote);
    setNewAmount(""); setNewNote(""); setRevOpen(false);
  }

  async function handleArchive() {
    if (!confirm(`Archive "${business.name}"? You can find archived businesses by editing the database.`)) return;
    await archiveBusiness(business.id);
    onClose();
  }

  const statusColor = STATUS_COLOR[status];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-950 border-t border-zinc-800 rounded-t-3xl max-h-[88vh] overflow-y-auto anim-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-5">
          {/* ── HERO ── */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <FormInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name !== business.name && saveField("name", name.trim())}
                className="text-base font-semibold"
              />
              <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2 flex-shrink-0">
                <X size={ICON.md} />
              </button>
            </div>

            {/* Stage + Category chips, tap to edit */}
            <div className="flex items-center gap-3 mb-4">
              <select
                value={status}
                onChange={(e) => { const s = e.target.value as BusinessStatus; setStatus(s); void saveField("status", s); }}
                className="text-[10px] uppercase tracking-widest font-bold bg-transparent border-0 outline-none cursor-pointer"
                style={{ color: statusColor }}
              >
                {STATUSES.map((s) => (<option key={s} value={s} className="bg-zinc-950 text-zinc-100">{s}</option>))}
              </select>
              <span className="text-zinc-700">·</span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onBlur={() => category !== (business.category ?? "") && saveField("category", category || null)}
                placeholder="add category"
                className="text-[10px] uppercase tracking-widest text-zinc-500 bg-transparent border-0 outline-none flex-1 min-w-0 placeholder:text-zinc-700"
              />
            </div>

            {/* MRR + sparkline + MoM */}
            <div className="flex items-end gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-baseline gap-1.5">
                  <span className={TYPE.display} style={{ color: business.monthly_revenue > 0 ? PALETTE.success : PALETTE.dim }}>
                    {fmtMoney(business.monthly_revenue)}
                  </span>
                  <span className="text-xs text-zinc-500">/mo</span>
                </div>
                {momPct != null && (
                  <span className="text-[10px] tabular-nums flex items-center gap-1 mt-1" style={{ color: momPct >= 0 ? PALETTE.success : PALETTE.danger }}>
                    <TrendingUp size={ICON.xs} style={{ transform: momPct < 0 ? "scaleY(-1)" : undefined }} />
                    {momPct >= 0 ? "+" : ""}{momPct}% vs ~3wk ago
                  </span>
                )}
              </div>
              <div className="flex-1 flex justify-end items-end">
                <MRRSparkline businessId={business.id} width={120} height={36} />
              </div>
            </div>
          </div>

          {/* ── LOG REVENUE — collapsed into a button until tapped ── */}
          {!revOpen ? (
            <button
              onClick={() => setRevOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs font-semibold hover:border-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <Plus size={ICON.sm} />
              Log this month's revenue
            </button>
          ) : (
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel className="mb-0">New revenue entry</FormLabel>
                <button onClick={() => { setRevOpen(false); setNewAmount(""); setNewNote(""); }} aria-label="Cancel" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2">
                  <X size={ICON.sm} />
                </button>
              </div>
              <div className="flex gap-2">
                <FormInput
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="e.g. 890"
                  className="flex-1"
                />
                <Button variant="primary" size="md" onClick={submitRevenue} disabled={!newAmount.trim()}>
                  Log
                </Button>
              </div>
              <FormInput
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="optional note (e.g. launched pricing change)"
              />
            </div>
          )}

          {/* ── TASKS — the main work surface ── */}
          <BusinessTasks businessId={business.id} />

          {/* ── AGENTS — workforce + artifact feedback ── */}
          <BusinessAgents business={business} />

          {/* ── ACTIVITY — chronological feed of everything that happened ── */}
          <BusinessActivity businessId={business.id} />

          {/* ── STATS — revenue history table + customers, collapsed by default ── */}
          <CollapsibleSection label="Stats" count={logs.length}>
            <div className="space-y-3">
              <div>
                <FormLabel>Customers</FormLabel>
                <FormInput
                  type="number"
                  inputMode="numeric"
                  value={customers}
                  onChange={(e) => setCustomers(e.target.value)}
                  onBlur={() => {
                    const n = parseInt(customers, 10);
                    if (isFinite(n) && n !== business.customer_count) void saveField("customer_count", n);
                  }}
                />
              </div>
              {logs.length > 0 && (
                <div>
                  <FormLabel>Revenue history</FormLabel>
                  <div className="space-y-1">
                    {[...logs].reverse().slice(0, 12).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-zinc-900/60 group">
                        <span className="text-[11px] text-zinc-500 w-20 tabular-nums">{r.log_date}</span>
                        <span className="text-sm font-semibold text-zinc-100 tabular-nums">{fmtMoney(r.amount)}</span>
                        {r.note && <span className="text-[11px] text-zinc-500 truncate flex-1">{r.note}</span>}
                        <button
                          onClick={() => deleteRevenue(r.id)}
                          aria-label="Delete entry"
                          className="text-zinc-700 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity -m-2 p-2"
                        >
                          <Trash2 size={ICON.xs} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* ── NOTES — free-form, collapsed by default ── */}
          <CollapsibleSection label="Notes" defaultOpen={!!business.notes}>
            <FormTextarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (business.notes ?? "") && saveField("notes", notes || null)}
              placeholder="Stack, decisions, links, ideas..."
            />
          </CollapsibleSection>

          {/* ── ARCHIVE — danger zone ── */}
          <div className="pt-2">
            <Button variant="danger" size="sm" fullWidth onClick={handleArchive}>
              <Archive size={ICON.sm} /> Archive business
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
