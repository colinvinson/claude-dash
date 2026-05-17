"use client";

import { useEffect, useState } from "react";
import { X, Archive, Trash2, TrendingUp, Plus, Pencil } from "lucide-react";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { useBusinesses, type Business, type BusinessStatus } from "@/hooks/useBusinesses";
import { useBusinessRevenue } from "@/hooks/useBusinessRevenue";
import { useBusinessTasks } from "@/hooks/useBusinessTasks";
import { useBusinessAgents } from "@/hooks/useBusinessAgents";
import { useBusinessActivity } from "@/hooks/useBusinessActivity";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";
import BusinessAgents from "./BusinessAgents";
import BusinessTasks from "./BusinessTasks";
import BusinessActivity from "./BusinessActivity";
import MRRSparkline from "./MRRSparkline";
import MarketingExperiments from "./MarketingExperiments";
import LinkedChats from "./LinkedChats";
import GoalsList from "@/components/goals/GoalsList";
import AddToWantsButton from "@/components/finances/AddToWantsButton";

// Per-business dashboard. Reframed from edit-form-y to read/act-first:
//
//   - Title is a big display H1, tap-to-edit (not always-input)
//   - Stage + Category sit as static chips, click to edit inline
//   - HERO: MRR + sparkline + MoM%
//   - QUICK STATS strip: customers / tasks open / agents / last activity
//   - LOG REVENUE: dashed-pill quick action
//   - TASKS / GOALS / AGENTS / EXPERIMENTS / CHATS / WANTS / ACTIVITY
//   - STATS (revenue history) — collapsed
//   - SETTINGS — collapsed bin for the edit-form fields: customers,
//     notes, archive. Read-only-by-default surfaces stay on the dashboard;
//     the rarely-edited stuff disappears into the drawer.

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

function fmtRecency(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60)  return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
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
  const { openTasks }     = useBusinessTasks(business.id);
  const { agents }        = useBusinessAgents(business.id);
  const { entries }       = useBusinessActivity(business.id, 1);
  const lastActivityAt    = entries[0]?.at ?? null;

  const [name, setName]             = useState(business.name);
  const [editingName, setEditingName] = useState(false);
  const [status, setStatus]         = useState<BusinessStatus>(business.status);
  const [category, setCategory]     = useState(business.category ?? "");
  const [customers, setCustomers]   = useState(String(business.customer_count));
  const [notes, setNotes]           = useState(business.notes ?? "");
  const [newAmount, setNewAmount]   = useState("");
  const [newNote, setNewNote]       = useState("");
  const [revOpen, setRevOpen]       = useState(false);

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

  function commitName() {
    setEditingName(false);
    if (name.trim() && name !== business.name) {
      void saveField("name", name.trim());
    } else {
      setName(business.name);
    }
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

          {/* ── HERO ────────────────────────────────────────────── */}
          <div>
            <div className="flex items-start justify-between gap-3">
              {editingName ? (
                <FormInput
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setName(business.name); setEditingName(false); } }}
                  className="text-xl font-bold"
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="group flex items-center gap-2 text-left flex-1 min-w-0"
                  aria-label="Edit name"
                >
                  <h1 className={`${TYPE.headline} truncate`}>{business.name}</h1>
                  <Pencil size={ICON.xs} className="text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              )}
              <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2 flex-shrink-0">
                <X size={ICON.md} />
              </button>
            </div>

            {/* Stage + Category — chip-styled, edit inline via select / input */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span
                className="text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full"
                style={{ background: `${statusColor}20`, color: statusColor }}
              >
                <select
                  value={status}
                  onChange={(e) => { const s = e.target.value as BusinessStatus; setStatus(s); void saveField("status", s); }}
                  className="bg-transparent border-0 outline-none cursor-pointer appearance-none pr-0"
                  style={{ color: statusColor }}
                >
                  {STATUSES.map((s) => (<option key={s} value={s} className="bg-zinc-950 text-zinc-100">{s}</option>))}
                </select>
              </span>
              <span
                className="text-[10px] uppercase tracking-widest text-zinc-500 px-2.5 py-1 rounded-full bg-zinc-800/60"
              >
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  onBlur={() => category !== (business.category ?? "") && saveField("category", category || null)}
                  placeholder="add category"
                  className="bg-transparent border-0 outline-none placeholder:text-zinc-700 w-[120px]"
                />
              </span>
            </div>

            {/* MRR + sparkline + MoM */}
            <div className="flex items-end gap-4 mt-5">
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

          {/* ── QUICK STATS — glanceable numbers ─────────────────── */}
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Customers"  value={business.customer_count > 0 ? String(business.customer_count) : "—"} />
            <Stat label="Tasks"      value={openTasks.length > 0 ? String(openTasks.length) : "—"} />
            <Stat label="Agents"     value={agents.length      > 0 ? String(agents.length)      : "—"} />
            <Stat label="Last"       value={fmtRecency(lastActivityAt)} />
          </div>

          {/* ── LOG REVENUE — primary quick action ──────────────── */}
          {!revOpen ? (
            <button
              onClick={() => setRevOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs font-semibold hover:border-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <Plus size={ICON.sm} />
              Log this month&apos;s revenue
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

          {/* ── TASKS ────────────────────────────────────────────── */}
          <BusinessTasks businessId={business.id} />

          {/* ── GOALS — nested per-business ──────────────────────── */}
          <div>
            <FormLabel>Goals</FormLabel>
            <GoalsList bucket="business" businessId={business.id} />
          </div>

          {/* ── AGENTS ───────────────────────────────────────────── */}
          <BusinessAgents business={business} />

          {/* ── MARKETING EXPERIMENTS ────────────────────────────── */}
          <MarketingExperiments businessId={business.id} />

          {/* ── LINKED CHATS ─────────────────────────────────────── */}
          <LinkedChats businessId={business.id} />

          {/* ── ADD TO WANTS ─────────────────────────────────────── */}
          <AddToWantsButton businessId={business.id} />

          {/* ── ACTIVITY — chronological feed ────────────────────── */}
          <BusinessActivity businessId={business.id} />

          {/* ── REVENUE HISTORY — collapsed reference data ──────── */}
          {logs.length > 0 && (
            <CollapsibleSection label="Revenue history" count={logs.length}>
              <div className="space-y-1">
                {[...logs].reverse().slice(0, 24).map((r) => (
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
            </CollapsibleSection>
          )}

          {/* ── SETTINGS — everything edit-form-y lives here ───── */}
          <CollapsibleSection label="Settings">
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
              <Button variant="danger" size="sm" fullWidth onClick={handleArchive}>
                <Archive size={ICON.sm} /> Archive business
              </Button>
            </div>
          </CollapsibleSection>

        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-2 py-2 text-center">
      <div className="text-base font-bold tabular-nums text-zinc-100 leading-none">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-zinc-500 mt-1">{label}</div>
    </div>
  );
}
