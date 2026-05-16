// Prompt builders for business-agent dispatch. Shared between the
// BusinessAgents UI (manual Run button) and the cron endpoint
// (scheduled runs) so both paths produce identical prompts — the
// agent's behavior shouldn't change based on what triggered it.

type BizContext = {
  id:              string;
  name:            string;
  status:          string;
  monthly_revenue: number;
  customer_count:  number;
  next_action:     string | null;
};

// Compact summary of one prior marketing experiment, formatted for
// inclusion in agent deploy prompts. Letting content-drafter agents
// see what's already been tried + what converted closes the learning
// loop — drafts grounded in real outcomes for Sir's audience instead
// of generic best practices.
type ExperimentBrief = {
  variant_label:      string;
  variant_text:       string;
  channel:            string;
  posted_at:          string | null;
  impressions:        number | null;
  clicks:             number | null;
  conversions:        number | null;
  revenue_attributed: number | null;
};

function experimentLine(e: ExperimentBrief): string {
  const text = e.variant_text.length > 140 ? e.variant_text.slice(0, 140) + "…" : e.variant_text;
  const bits: string[] = [`[${e.channel}] "${text}"`];
  const m: string[] = [];
  if (e.impressions != null)       m.push(`${e.impressions} views`);
  if (e.clicks      != null)       m.push(`${e.clicks} clicks`);
  if (e.conversions != null)       m.push(`${e.conversions} conv`);
  if (e.revenue_attributed != null && e.revenue_attributed > 0) m.push(`$${Math.round(e.revenue_attributed)}`);
  if (m.length > 0) bits.push(`(${m.join(", ")})`);
  else if (!e.posted_at) bits.push("(draft, no outcome yet)");
  else bits.push("(posted, no metrics yet)");
  return `  - ${e.variant_label}: ${bits.join(" ")}`;
}

function experimentsBlock(experiments: ExperimentBrief[]): string {
  if (experiments.length === 0) return "";
  return (
    `\n\nRecent marketing experiments for this business (most recent first — use these as ground truth for what does and doesn't work with Sir's audience; don't repeat losing patterns, double down on what's converting):\n` +
    experiments.slice(0, 12).map(experimentLine).join("\n")
  );
}

export function businessContextLine(b: BizContext): string {
  const bits = [
    `business "${b.name}"`,
    `stage: ${b.status}`,
  ];
  if (b.monthly_revenue > 0) bits.push(`MRR: $${Math.round(b.monthly_revenue)}/mo`);
  if (b.customer_count > 0)  bits.push(`${b.customer_count} customers`);
  if (b.next_action)         bits.push(`next action: ${b.next_action}`);
  return bits.join(" · ");
}

// Append-to-every-prompt instruction: tag any artifacts the agent
// produces back to this business + role so the BusinessAgents UI
// surfaces them inline. Without this, outputs scatter into the global
// artifact list with no link back.
export function artifactTagInstructions(businessId: string, businessAgentId: string): string {
  return ` When the agent produces an artifact via write_artifact, pass business_id="${businessId}" and business_agent_id="${businessAgentId}" so the output surfaces on this business.`;
}

export function buildRunPrompt(args: {
  business:           BizContext;
  businessAgentId:    string;
  agentName:          string | null;
  roleLabel:          string;
  purpose:            string | null;
  scheduled?:         boolean;
  recentExperiments?: ExperimentBrief[];
}): string {
  const target = args.agentName ? `the "${args.agentName}" agent` : `a generic Claude Code agent`;
  const lead   = args.scheduled
    ? `Scheduled run — dispatch ${target}`
    : `Dispatch ${target}`;
  return (
    `${lead} for ${businessContextLine(args.business)}. Role: ${args.roleLabel}.` +
    `${args.purpose ? ` Purpose: ${args.purpose}.` : ""}` +
    ` Run it now with the business context above as grounding. Return the session id when dispatched.` +
    artifactTagInstructions(args.business.id, args.businessAgentId) +
    experimentsBlock(args.recentExperiments ?? [])
  );
}
