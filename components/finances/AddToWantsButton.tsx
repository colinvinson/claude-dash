"use client";

import { useState } from "react";
import { ShoppingBag, X, Wrench, Sparkles } from "lucide-react";
import { FormInput } from "@/components/ui/FormInput";
import Button from "@/components/ui/Button";
import { useWishlist, type WishlistKind } from "@/hooks/useWishlist";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";

// "Add to wants" button. Drops inline on a GoalWidget or BusinessDetail
// sheet — tapping opens a small form, on submit creates a wishlist
// item with the goal/business backlink pre-filled. Item then surfaces
// in the Finances tab's Wants section AND counts toward that entity's
// "things needed to make progress" total.

export default function AddToWantsButton({
  goalId,
  businessId,
}: {
  goalId?:     string | null;
  businessId?: string | null;
}) {
  const { addItem } = useWishlist({});
  const [open, setOpen]   = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [kind, setKind]   = useState<WishlistKind>("leverage");
  const [busy, setBusy]   = useState(false);

  function reset() { setTitle(""); setPrice(""); setKind("leverage"); setOpen(false); }

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const p = parseFloat(price);
    await addItem({
      title,
      price:       isFinite(p) ? p : null,
      kind,
      goal_id:     goalId     ?? null,
      business_id: businessId ?? null,
    });
    setBusy(false);
    reset();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 -m-2 p-2"
      >
        <ShoppingBag size={ICON.xs} /> Add to wants
      </button>
    );
  }

  return (
    <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className={TYPE.label}>New want for this {businessId ? "business" : "goal"}</span>
        <button onClick={reset} aria-label="Cancel" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2">
          <X size={ICON.sm} />
        </button>
      </div>
      <FormInput
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What do you need to buy?"
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
        <div className="flex-1 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setKind("leverage")}
            className={`py-2 rounded-lg text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-1 transition-colors ${
              kind === "leverage" ? "bg-white text-zinc-900" : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            <Wrench size={ICON.xs} /> Leverage
          </button>
          <button
            type="button"
            onClick={() => setKind("consumption")}
            className={`py-2 rounded-lg text-[10px] uppercase tracking-widest font-bold flex items-center justify-center gap-1 transition-colors ${
              kind === "consumption" ? "bg-white text-zinc-900" : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            <Sparkles size={ICON.xs} /> Consumption
          </button>
        </div>
      </div>
      <Button variant="primary" size="sm" fullWidth onClick={submit} loading={busy} disabled={!title.trim()}>
        Add to Finances → Wants
      </Button>
      <p className="text-[10px] text-zinc-600 leading-snug">
        Shows up in <span style={{ color: PALETTE.celebration }}>/finances</span> tagged to this {businessId ? "business" : "goal"}.
      </p>
    </div>
  );
}
