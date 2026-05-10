"use client";

import { useState } from "react";
import { useFinances } from "@/hooks/useFinances";
import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";
import { Trash2, Plus, X } from "lucide-react";

export default function FinancesContent() {
  const { subs, orders, loading, monthlyBurn, addSub, removeSub, addOrder, markArrived } = useFinances();
  const [subName, setSubName]   = useState("");
  const [subAmt, setSubAmt]     = useState("");
  const [orderName, setOrderName] = useState("");

  async function handleAddSub() {
    if (!subName.trim() || !subAmt) return;
    await addSub(subName.trim(), parseFloat(subAmt));
    setSubName(""); setSubAmt("");
  }

  async function handleAddOrder() {
    if (!orderName.trim()) return;
    await addOrder(orderName.trim());
    setOrderName("");
  }

  return (
    <>
      <div>
        <SectionLabel>Active Subscriptions</SectionLabel>
        <Card>
          <div className="mb-4">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Monthly Burn</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-bold text-white">
                USD {loading ? "—" : monthlyBurn.toFixed(2)}
              </span>
              <span className="text-xs text-zinc-500">/ mo</span>
            </div>
            {!loading && (
              <span className="text-[11px] text-zinc-600">
                ~USD {(monthlyBurn * 12).toFixed(2)} per year
              </span>
            )}
          </div>
          <div className="space-y-0">
            {subs.length === 0 && !loading && (
              <p className="text-sm text-zinc-600 py-2">No subscriptions yet.</p>
            )}
            {subs.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 py-3 border-b border-[#1f1f1f] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100">{sub.service_name}</p>
                  <p className="text-[11px] text-zinc-500">{sub.billing_cycle}</p>
                  {sub.next_renewal && (
                    <p className="text-[11px] text-zinc-600">↻ Renews {sub.next_renewal}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-zinc-200 whitespace-nowrap">
                  {sub.currency} {sub.amount.toFixed(2)}
                </span>
                <button onClick={() => removeSub(sub.id)} className="text-zinc-700 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1f1f1f]">
            <input value={subName} onChange={(e) => setSubName(e.target.value)}
              placeholder="Service"
              className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600" />
            <input value={subAmt} onChange={(e) => setSubAmt(e.target.value)} type="number"
              placeholder="Amount"
              className="w-20 bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600" />
            <button onClick={handleAddSub}
              className="flex items-center gap-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs font-semibold text-zinc-100 transition-colors">
              <Plus size={12} /> Add
            </button>
          </div>
        </Card>
      </div>

      <div>
        <SectionLabel>Incoming Orders</SectionLabel>
        <Card>
          {orders.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                  {o.item_name}
                  <button onClick={() => markArrived(o.id)} className="text-zinc-600 hover:text-green-400 transition-colors">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {orders.length === 0 && !loading && (
            <p className="text-sm text-zinc-600 mb-3">No incoming orders.</p>
          )}
          <div className="flex gap-2">
            <input value={orderName} onChange={(e) => setOrderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddOrder()}
              placeholder="Add an incoming order…"
              className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600" />
            <button onClick={handleAddOrder}
              className="flex items-center gap-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs font-semibold text-zinc-100 transition-colors">
              <Plus size={12} /> Add
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
