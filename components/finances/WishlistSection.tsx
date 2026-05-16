"use client";

import { useState } from "react";
import { Plus, X, ShoppingBag, ExternalLink, Check, Trash2, Wrench, Sparkles, AlertTriangle } from "lucide-react";
import Card from "@/components/ui/Card";
import { FormInput, FormSelect } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import { useWishlist, type WishlistItem, type WishlistKind } from "@/hooks/useWishlist";
import { useBusinesses } from "@/hooks/useBusinesses";
import { useLongTermGoals } from "@/hooks/useLongTermGoals";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";

// Wants list — the "products to buy" surface inside the Finances tab.
// Per Sir's directive ("rich, not wannabe entrepreneur"), each item
// is tagged leverage (compounds — tools/equipment that produce income)
// or consumption (lifestyle). The leverage/consumption split is the
// load-bearing asymmetry — if consumption outpaces leverage, the
// strategic surface calls it out.

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export default function WishlistSection() {
  const { wantedItems, boughtItems, totalWanted, wantedLeverage, wantedConsumption, addItem, markBought, dismissItem, archiveItem } = useWishlist({});
  const { businesses } = useBusinesses();
  const { goals }      = useLongTermGoals();
  const [adding, setAdding]         = useState(false);
  const [showBought, setShowBought] = useState(false);
  const [title, setTitle]           = useState("");
  const [price, setPrice]           = useState("");
  const [kind, setKind]             = useState<WishlistKind>("consumption");
  const [goalId, setGoalId]         = useState("");
  const [bizId, setBizId]           = useState("");
  const [url, setUrl]               = useState("");
  const [busy, setBusy]             = useState(false);

  function reset() {
    setTitle(""); setPrice(""); setKind("consumption"); setGoalId(""); setBizId(""); setUrl(""); setAdding(false);
  }

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const priceNum = parseFloat(price);
    await addItem({
      title,
      price:       isFinite(priceNum) ? priceNum : null,
      kind,
      url:         url || null,
      goal_id:     goalId || null,
      business_id: bizId  || null,
    });
    setBusy(false);
    reset();
  }

  // Consumption > leverage by more than 2x = flag (the dashboard-theater
  // asymmetry Sir asked the system to call out).
  const consumptionOverleveraged = wantedConsumption > 0 && wantedConsumption > wantedLeverage * 2;

  return (
    <Card variant="primary">
      <div className="flex items-baseline justify-between mb-3">
        <span className={TYPE.label}>Wants</span>
        <span className="text-[11px] text-zinc-500 tabular-nums">
          {fmt(totalWanted)} open
        </span>
      </div>

      {wantedItems.length === 0 && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs font-semibold hover:border-zinc-700 hover:text-zinc-300 transition-colors"
        >
          <ShoppingBag size={ICON.sm} />
          Add the first thing you want to buy
        </button>
      )}

      {(wantedLeverage > 0 || wantedConsumption > 0) && (
        <div className="flex items-center gap-3 text-[10px] mb-3 tabular-nums">
          <span className="flex items-center gap-1" style={{ color: PALETTE.success }}>
            <Wrench size={ICON.xs} /> Leverage {fmt(wantedLeverage)}
          </span>
          <span className="flex items-center gap-1 text-zinc-500">
            <Sparkles size={ICON.xs} /> Consumption {fmt(wantedConsumption)}
          </span>
          {consumptionOverleveraged && (
            <span className="flex items-center gap-1 ml-auto" style={{ color: PALETTE.warning }}>
              <AlertTriangle size={ICON.xs} /> Consumption {">"} 2× leverage
            </span>
          )}
        </div>
      )}

      {wantedItems.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {wantedItems.map((item) => (
            <WantRow
              key={item.id}
              item={item}
              businessName={businesses.find((b) => b.id === item.business_id)?.name ?? null}
              goalTitle={goals.find((g) => g.id === item.goal_id)?.title ?? null}
              onBuy={() => markBought(item.id)}
              onDismiss={() => dismissItem(item.id)}
            />
          ))}
        </div>
      )}

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs font-semibold hover:border-zinc-700 hover:text-zinc-300 transition-colors"
        >
          <Plus size={ICON.sm} /> Add a want
        </button>
      ) : (
        <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className={TYPE.label}>New want</span>
            <button onClick={reset} aria-label="Cancel" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2">
              <X size={ICON.sm} />
            </button>
          </div>
          <FormInput
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to buy?"
          />
          <div className="flex gap-2">
            <FormInput
              type="number"
              inputMode="decimal"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="$"
              className="w-24"
            />
            <FormSelect
              value={kind}
              onChange={(e) => setKind(e.target.value as WishlistKind)}
              className="flex-1"
            >
              <option value="leverage">Leverage (compounds income)</option>
              <option value="consumption">Consumption (lifestyle)</option>
            </FormSelect>
          </div>
          <div className="flex gap-2">
            <FormSelect
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="flex-1"
            >
              <option value="">No goal link</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </FormSelect>
            <FormSelect
              value={bizId}
              onChange={(e) => setBizId(e.target.value)}
              className="flex-1"
            >
              <option value="">No business link</option>
              {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </FormSelect>
          </div>
          <FormInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (optional)"
          />
          <Button variant="primary" size="md" fullWidth onClick={submit} loading={busy} disabled={!title.trim()}>
            Add to wants
          </Button>
        </div>
      )}

      {boughtItems.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowBought((s) => !s)}
            className="text-[10px] uppercase tracking-widest font-bold text-zinc-600 hover:text-zinc-400"
          >
            {showBought ? "Hide" : "Show"} {boughtItems.length} bought
          </button>
          {showBought && (
            <div className="space-y-1.5 mt-2">
              {boughtItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/40">
                  <Check size={ICON.xs} style={{ color: PALETTE.success }} />
                  <span className="text-[11px] text-zinc-400 line-through flex-1 truncate">{item.title}</span>
                  {item.cost_actual != null && (
                    <span className="text-[10px] text-zinc-500 tabular-nums">{fmt(item.cost_actual)}</span>
                  )}
                  <button onClick={() => archiveItem(item.id)} aria-label="Archive" className="text-zinc-700 hover:text-zinc-400 -m-2 p-2">
                    <Trash2 size={ICON.xs} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function WantRow({
  item, businessName, goalTitle, onBuy, onDismiss,
}: {
  item:         WishlistItem;
  businessName: string | null;
  goalTitle:    string | null;
  onBuy:        () => void;
  onDismiss:    () => void;
}) {
  const Kind = item.kind === "leverage" ? Wrench : Sparkles;
  const kindColor = item.kind === "leverage" ? PALETTE.success : PALETTE.dim;
  const linkLabel = businessName ?? goalTitle ?? null;

  return (
    <div className="flex items-start gap-2 p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 group">
      <Kind size={ICON.sm} style={{ color: kindColor }} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-zinc-100 truncate">{item.title}</span>
          {item.price != null && (
            <span className="text-[11px] text-zinc-400 tabular-nums">{fmt(item.price)}</span>
          )}
        </div>
        {linkLabel && (
          <p className="text-[10px] text-zinc-500 truncate mt-0.5">→ {linkLabel}</p>
        )}
      </div>
      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" aria-label="Open link" className="flex-shrink-0 text-zinc-500 hover:text-zinc-200 -m-2 p-2">
          <ExternalLink size={ICON.xs} />
        </a>
      )}
      <button onClick={onBuy} aria-label="Mark bought" className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-zinc-900" style={{ background: PALETTE.success }}>
        Buy
      </button>
      <button onClick={onDismiss} aria-label="Dismiss" className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity -m-2 p-2">
        <Trash2 size={ICON.xs} />
      </button>
    </div>
  );
}
