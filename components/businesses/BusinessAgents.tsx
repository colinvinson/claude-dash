"use client";

import { useState } from "react";
import { Play, Trash2, Plus, X, Bot } from "lucide-react";
import { FormInput, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import { useBusinessAgents } from "@/hooks/useBusinessAgents";
import type { Business } from "@/hooks/useBusinesses";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";

// Per-business agent workforce surface. Renders inside BusinessDetail.
//
// Two flows:
//   - Deploy NEW agent — fills form, posts to Jarvis to call cc_define_agent,
//     immediately writes the assignment row. Jarvis HUD opens with the
//     define+dispatch prompt prefilled.
//   - Run EXISTING agent — fires a deploy prompt at Jarvis with the
//     business's current context auto-injected so the agent runs grounded.

function timeSinceShort(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)   return "just now";
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function openJarvis(prompt: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("jarvis:open", { detail: { prompt } }));
}

function businessContextLine(b: Business): string {
  const bits = [
    `business "${b.name}"`,
    `stage: ${b.status}`,
  ];
  if (b.monthly_revenue > 0) bits.push(`MRR: $${Math.round(b.monthly_revenue)}/mo`);
  if (b.customer_count > 0)  bits.push(`${b.customer_count} customers`);
  if (b.next_action)         bits.push(`next action: ${b.next_action}`);
  return bits.join(" · ");
}

export default function BusinessAgents({ business }: { business: Business }) {
  const { agents, assignAgent, removeAgent, markRun } = useBusinessAgents(business.id);
  const [adding, setAdding]         = useState(false);
  const [roleLabel, setRoleLabel]   = useState("");
  const [purpose, setPurpose]       = useState("");
  const [busy, setBusy]             = useState(false);

  function resetForm() {
    setRoleLabel(""); setPurpose(""); setAdding(false);
  }

  async function deployNew() {
    if (!roleLabel.trim() || busy) return;
    setBusy(true);
    // Agent name is the kebab-cased role + business slug — deterministic so
    // the .claude/agents/<name>.md file is predictable.
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const agentName = `${slug(business.name)}-${slug(roleLabel)}`.slice(0, 64);
    const row = await assignAgent({ agent_name: agentName, role_label: roleLabel, purpose });
    setBusy(false);
    if (!row) return;
    // Prefill Jarvis with a define + dispatch prompt. Jarvis will call
    // cc_define_agent then cc_run_agent with the business context.
    const prompt = `Define a new Claude Code agent named "${agentName}" for ${businessContextLine(business)}. Its role: ${roleLabel}.${purpose ? ` Purpose: ${purpose}.` : ""} Pick the right tools + model for this kind of work, then dispatch it immediately on a first run grounded in the business context above.`;
    openJarvis(prompt);
    void markRun(row.id);
    resetForm();
  }

  async function runExisting(agentId: string, agentName: string | null, roleLabel: string, purpose: string | null) {
    const target = agentName ? `the "${agentName}" agent` : `a generic Claude Code agent`;
    const prompt = `Dispatch ${target} for ${businessContextLine(business)}. Role: ${roleLabel}.${purpose ? ` Purpose: ${purpose}.` : ""} Run it now with the business context above as grounding. Return the session id when dispatched.`;
    openJarvis(prompt);
    void markRun(agentId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <FormLabel className="mb-0">Agents</FormLabel>
        {!adding && agents.length > 0 && (
          <button
            onClick={() => setAdding(true)}
            className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-zinc-300 -m-2 p-2 flex items-center gap-1"
          >
            <Plus size={ICON.xs} /> Deploy
          </button>
        )}
      </div>

      {agents.length === 0 && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-400 text-xs font-semibold hover:border-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <Bot size={ICON.sm} />
          Deploy first agent for this business
        </button>
      )}

      {agents.length > 0 && (
        <div className="space-y-2">
          {agents.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
              <Bot size={ICON.sm} className="text-zinc-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100">{a.role_label}</p>
                {a.purpose && <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{a.purpose}</p>}
                <p className="text-[10px] text-zinc-600 mt-1 tabular-nums">
                  {a.agent_name ? <span className="text-zinc-500">{a.agent_name}</span> : <span className="italic">pending define</span>}
                  <span className="mx-1.5">·</span>
                  last run {timeSinceShort(a.last_run_at)}
                </p>
              </div>
              <button
                onClick={() => runExisting(a.id, a.agent_name, a.role_label, a.purpose)}
                aria-label={`Run ${a.role_label}`}
                className="flex-shrink-0 px-3 py-2 rounded-lg text-zinc-900 text-xs font-bold flex items-center gap-1"
                style={{ background: PALETTE.success }}
              >
                <Play size={ICON.xs} fill="currentColor" strokeWidth={0} /> Run
              </button>
              <button
                onClick={() => { if (confirm(`Remove "${a.role_label}" assignment? The agent definition itself isn't deleted.`)) void removeAgent(a.id); }}
                aria-label="Remove"
                className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 -m-2 p-2"
              >
                <Trash2 size={ICON.xs} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className={TYPE.label}>New agent role</span>
            <button onClick={resetForm} aria-label="Cancel" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2">
              <X size={ICON.sm} />
            </button>
          </div>
          <div>
            <FormLabel>Role</FormLabel>
            <FormInput
              autoFocus
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
              placeholder="Competitor watcher, content drafter, churn analyst..."
            />
          </div>
          <div>
            <FormLabel>What it does</FormLabel>
            <FormTextarea
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Daily scan of competitor pricing pages, surface changes as an artifact..."
            />
          </div>
          <Button variant="primary" size="md" fullWidth onClick={deployNew} loading={busy} disabled={!roleLabel.trim()}>
            <Bot size={ICON.sm} /> Define + dispatch
          </Button>
          <p className="text-[10px] text-zinc-600 leading-snug">
            Jarvis will write the agent definition to <span className="text-zinc-500 font-mono">.claude/agents/</span> and run it once with this business's context.
          </p>
        </div>
      )}
    </div>
  );
}
