"use client";

import { useState } from "react";
import { Play, Trash2, Plus, X, Bot, FileText, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import Button from "@/components/ui/Button";
import { useBusinessAgents, type BusinessAgent } from "@/hooks/useBusinessAgents";
import { useBusinessAgentArtifacts, type BusinessArtifact } from "@/hooks/useBusinessAgentArtifacts";
import type { Business } from "@/hooks/useBusinesses";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";
import { artifactTagInstructions, businessContextLine } from "@/lib/businesses/agent-prompts";
import { describeSchedule, type ScheduleKind } from "@/lib/businesses/schedule";

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

export default function BusinessAgents({ business }: { business: Business }) {
  const { agents, assignAgent, removeAgent, markRun, setSchedule } = useBusinessAgents(business.id);
  const { latestByAgent } = useBusinessAgentArtifacts(business.id);
  const [adding, setAdding]         = useState(false);
  const [roleLabel, setRoleLabel]   = useState("");
  const [purpose, setPurpose]       = useState("");
  const [busy, setBusy]             = useState(false);
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

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
    const prompt =
      `Define a new Claude Code agent named "${agentName}" for ${businessContextLine(business)}. Its role: ${roleLabel}.` +
      `${purpose ? ` Purpose: ${purpose}.` : ""}` +
      ` Pick the right tools + model for this kind of work, then dispatch it immediately on a first run grounded in the business context above.` +
      artifactTagInstructions(business.id, row.id);
    openJarvis(prompt);
    void markRun(row.id);
    resetForm();
  }

  async function runExisting(agentId: string, agentName: string | null, roleLabel: string, purpose: string | null) {
    const target = agentName ? `the "${agentName}" agent` : `a generic Claude Code agent`;
    const prompt =
      `Dispatch ${target} for ${businessContextLine(business)}. Role: ${roleLabel}.` +
      `${purpose ? ` Purpose: ${purpose}.` : ""}` +
      ` Run it now with the business context above as grounding. Return the session id when dispatched.` +
      artifactTagInstructions(business.id, agentId);
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
          {agents.map((a) => {
            const latest   = latestByAgent.get(a.id);
            const expanded = latest && expandedArtifactId === latest.id;
            return (
              <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="flex items-start gap-3 p-3">
                  <Bot size={ICON.sm} className="text-zinc-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100">{a.role_label}</p>
                    {a.purpose && <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{a.purpose}</p>}
                    <p className="text-[10px] text-zinc-600 mt-1 tabular-nums">
                      {a.agent_name ? <span className="text-zinc-500">{a.agent_name}</span> : <span className="italic">pending define</span>}
                      <span className="mx-1.5">·</span>
                      last run {timeSinceShort(a.last_run_at)}
                      {a.schedule_kind !== "none" && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span style={{ color: PALETTE.info }}>{describeSchedule({ kind: a.schedule_kind, hour: a.schedule_hour ?? undefined, dow: a.schedule_dow ?? undefined, dom: a.schedule_dom ?? undefined })}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setSchedulingId(schedulingId === a.id ? null : a.id)}
                    aria-label={`Schedule ${a.role_label}`}
                    className="flex-shrink-0 text-zinc-500 hover:text-zinc-200 -m-2 p-2"
                  >
                    <Clock size={ICON.sm} style={{ color: a.schedule_kind !== "none" ? PALETTE.info : undefined }} />
                  </button>
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

                {/* Inline schedule picker — toggles via the clock icon */}
                {schedulingId === a.id && (
                  <SchedulePicker
                    agent={a}
                    onSave={(kind, hour, dow, dom) => { void setSchedule(a.id, { kind, hour, dow, dom }); setSchedulingId(null); }}
                    onClose={() => setSchedulingId(null)}
                  />
                )}

                {/* Latest artifact preview — the workforce feedback loop.
                    Click expands the full content inline. */}
                {latest && (
                  <ArtifactRow
                    artifact={latest}
                    expanded={!!expanded}
                    onToggle={() => setExpandedArtifactId(expanded ? null : latest.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Spacer between agents and adding flow — only when both exist */}
      {adding && agents.length > 0 && <div className="mt-3" />}

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

// Inline schedule picker — three kinds (daily / weekly / monthly) plus
// hour. Cron route reads next_run_at and dispatches when due.
function SchedulePicker({
  agent, onSave, onClose,
}: {
  agent:   BusinessAgent;
  onSave:  (kind: ScheduleKind, hour?: number, dow?: number, dom?: number) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<ScheduleKind>(agent.schedule_kind);
  const [hour, setHour] = useState<number>(agent.schedule_hour ?? 9);
  const [dow,  setDow]  = useState<number>(agent.schedule_dow  ?? 1);
  const [dom,  setDom]  = useState<number>(agent.schedule_dom  ?? 1);

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const DAYS  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="border-t border-zinc-800 px-3 py-3 bg-zinc-900/40 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className={TYPE.label}>Schedule</span>
        <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2">
          <X size={ICON.xs} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {(["none", "daily", "weekly", "monthly"] as ScheduleKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-colors ${
              kind === k ? "bg-white text-zinc-900" : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {k === "none" ? "off" : k}
          </button>
        ))}
      </div>
      {kind !== "none" && (
        <div className="flex gap-2">
          {kind === "weekly" && (
            <FormSelect value={String(dow)} onChange={(e) => setDow(parseInt(e.target.value, 10))} className="flex-1">
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </FormSelect>
          )}
          {kind === "monthly" && (
            <FormSelect value={String(dom)} onChange={(e) => setDom(parseInt(e.target.value, 10))} className="flex-1">
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}</option>)}
            </FormSelect>
          )}
          <FormSelect value={String(hour)} onChange={(e) => setHour(parseInt(e.target.value, 10))} className="flex-1">
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h === 0 ? 12 : h > 12 ? h - 12 : h}{h < 12 ? "am" : "pm"}
              </option>
            ))}
          </FormSelect>
        </div>
      )}
      <Button
        variant="primary"
        size="sm"
        fullWidth
        onClick={() => onSave(kind, kind === "none" ? undefined : hour, kind === "weekly" ? dow : undefined, kind === "monthly" ? dom : undefined)}
      >
        Save schedule
      </Button>
    </div>
  );
}

// Inline preview of an agent's latest artifact. Collapsed: name + preview
// of first line + relative time. Expanded: full content (markdown rendered
// as plain text — keeps the surface light; full markdown can ship later).
function ArtifactRow({
  artifact, expanded, onToggle,
}: {
  artifact: BusinessArtifact;
  expanded: boolean;
  onToggle: () => void;
}) {
  const preview = artifact.content.split("\n").find((l) => l.trim().length > 0)?.slice(0, 140) ?? "";
  return (
    <button
      onClick={onToggle}
      className="w-full text-left border-t border-zinc-800 px-3 py-2.5 hover:bg-zinc-900/80 transition-colors"
    >
      <div className="flex items-start gap-2">
        <FileText size={ICON.xs} className="text-zinc-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-300 truncate">{artifact.name}</span>
            <span className="text-[10px] text-zinc-600 tabular-nums flex-shrink-0">{timeSinceShort(artifact.created_at)}</span>
          </div>
          {!expanded && preview && (
            <p className="text-[11px] text-zinc-500 leading-snug mt-0.5 line-clamp-2">{preview}</p>
          )}
        </div>
        {expanded
          ? <ChevronUp   size={ICON.xs} className="text-zinc-600 mt-1 flex-shrink-0" />
          : <ChevronDown size={ICON.xs} className="text-zinc-600 mt-1 flex-shrink-0" />}
      </div>
      {expanded && (
        <div className="mt-2 ml-5 pr-2">
          <pre className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans max-h-80 overflow-y-auto">
            {artifact.content}
          </pre>
        </div>
      )}
    </button>
  );
}
