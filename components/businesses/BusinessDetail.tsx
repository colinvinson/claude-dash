"use client";

import { useEffect, useState } from "react";
import { X, Archive, Trash2, TrendingUp, Plus } from "lucide-react";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import { useBusinesses, type Business, type BusinessStatus } from "@/hooks/useBusinesses";
import { useBusinessRevenue } from "@/hooks/useBusinessRevenue";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";

// Per-business drill-in sheet. Slides up from the bottom; tap anywhere
// outside the sheet to close. Holds everything specific to one business:
// status, MRR + revenue log, customers, next action, notes, archive.
//
// Revenue log is the core feature — every entry is a {date, amount} pair
// that drives MoM growth + lets us see the trajectory inline.

const STATUSES: BusinessStatus[] = ["idea", "building", "live", "growing", "paused"];

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
  const [name, setName]                     = useState(business.name);
  const [status, setStatus]                 = useState<BusinessStatus>(business.status);
  const [category, setCategory]             = useState(business.category ?? "");
  const [customers, setCustomers]           = useState(String(business.customer_count));
  const [nextAction, setNextAction]         = useState(business.next_action ?? "");
  const [notes, setNotes]                   = useState(business.notes ?? "");
  const [newAmount, setNewAmount]           = useState("");
  const [newNote, setNewNote]               = useState("");

  // Reset local state when the displayed business changes (parent reuses
  // the same sheet for different rows).
  useEffect(() => {
    setName(business.name);
    setStatus(business.status);
    setCategory(business.category ?? "");
    setCustomers(String(business.customer_count));
    setNextAction(business.next_action ?? "");
    setNotes(business.notes ?? "");
  }, [business]);

  async function saveField<K extends keyof Business>(field: K, value: Business[K]) {
    await updateBusiness(business.id, { [field]: value } as Partial<Business>);
  }

  async function submitRevenue() {
    const amt = parseFloat(newAmount);
    if (!isFinite(amt) || amt < 0) return;
    await logRevenue(amt, newNote);
    setNewAmount(""); setNewNote("");
  }

  async function handleArchive() {
    if (!confirm(`Archive "${business.name}"? You can find archived businesses by editing the database.`)) return;
    await archiveBusiness(business.id);
    onClose();
  }

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
          {/* Header — name + close */}
          <div className="flex items-start justify-between gap-3">
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

          {/* Stage + category */}
          <div className="flex gap-3">
            <div className="flex-1">
              <FormLabel>Stage</FormLabel>
              <FormSelect
                value={status}
                onChange={(e) => { const s = e.target.value as BusinessStatus; setStatus(s); void saveField("status", s); }}
              >
                {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </FormSelect>
            </div>
            <div className="flex-1">
              <FormLabel>Category</FormLabel>
              <FormInput
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                onBlur={() => category !== (business.category ?? "") && saveField("category", category || null)}
                placeholder="SaaS / content / etc"
              />
            </div>
          </div>

          {/* MRR + customers — the two numbers that matter */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <FormLabel className="mb-0">Monthly revenue</FormLabel>
              {momPct != null && (
                <span className="text-[10px] tabular-nums flex items-center gap-1" style={{ color: momPct >= 0 ? PALETTE.success : PALETTE.danger }}>
                  <TrendingUp size={ICON.xs} style={{ transform: momPct < 0 ? "scaleY(-1)" : undefined }} />
                  {momPct >= 0 ? "+" : ""}{momPct}% vs ~3wk ago
                </span>
              )}
            </div>
            <div className="text-3xl font-black tabular-nums" style={{ color: business.monthly_revenue > 0 ? PALETTE.success : PALETTE.dim }}>
              {fmtMoney(business.monthly_revenue)}<span className="text-xs text-zinc-500 font-normal">/mo</span>
            </div>
          </div>

          {/* Log new revenue */}
          <div>
            <FormLabel>Log this month's revenue</FormLabel>
            <div className="flex gap-2">
              <FormInput
                type="number"
                inputMode="decimal"
                step="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="e.g. 890"
                className="flex-1"
              />
              <Button variant="primary" size="md" onClick={submitRevenue} disabled={!newAmount.trim()}>
                <Plus size={ICON.sm} /> Log
              </Button>
            </div>
            <FormInput
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="optional note (e.g. launched pricing change)"
              className="mt-2"
            />
          </div>

          {/* Revenue history — most recent first */}
          {logs.length > 0 && (
            <div>
              <FormLabel>History</FormLabel>
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

          {/* Customers */}
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

          {/* Next action — the one thing to do for this business */}
          <div>
            <FormLabel>Next action</FormLabel>
            <FormInput
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              onBlur={() => nextAction !== (business.next_action ?? "") && saveField("next_action", nextAction || null)}
              placeholder="Ship pricing-page A/B, write launch post..."
            />
          </div>

          {/* Notes — running log of decisions, ideas, links */}
          <div>
            <FormLabel>Notes</FormLabel>
            <FormTextarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (business.notes ?? "") && saveField("notes", notes || null)}
              placeholder="Stack, decisions, links, ideas..."
            />
          </div>

          {/* Archive */}
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
