"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import Card from "@/components/ui/Card";
import { FormInput, FormSelect } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import { useBusinesses, type BusinessStatus } from "@/hooks/useBusinesses";
import { ICON } from "@/lib/design-tokens";

// Add-business sheet. Inline on /businesses — opens via a + button at the
// top of the list. Fields are minimal on purpose: name + status +
// category. The detail sheet handles everything else (revenue, customers,
// next action, notes). Less to fill out on creation = lower friction.

const STATUSES: BusinessStatus[] = ["idea", "building", "live", "growing", "paused"];

export default function AddBusinessFlow() {
  const { addBusiness } = useBusinesses();
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState("");
  const [status, setStatus]     = useState<BusinessStatus>("idea");
  const [category, setCategory] = useState("");
  const [busy, setBusy]         = useState(false);

  function reset() {
    setName(""); setStatus("idea"); setCategory(""); setOpen(false);
  }

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await addBusiness({ name, status, category: category || undefined });
    setBusy(false);
    if (created) reset();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-400 text-xs font-semibold hover:border-zinc-500 hover:text-zinc-200 transition-colors"
      >
        <Plus size={ICON.sm} />
        Add a business
      </button>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-100">New business</h3>
        <button onClick={reset} aria-label="Cancel" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2">
          <X size={ICON.sm} />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <FormLabel>Name</FormLabel>
          <FormInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="SaaS v2, Newsletter, E-com store..."
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <FormLabel>Stage</FormLabel>
            <FormSelect value={status} onChange={(e) => setStatus(e.target.value as BusinessStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </FormSelect>
          </div>
          <div className="flex-1">
            <FormLabel>Category</FormLabel>
            <FormInput
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="SaaS / content / etc"
            />
          </div>
        </div>
        <Button variant="primary" size="md" fullWidth onClick={submit} loading={busy} disabled={!name.trim()}>
          Add business
        </Button>
      </div>
    </Card>
  );
}
