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
  business:        BizContext;
  businessAgentId: string;
  agentName:       string | null;
  roleLabel:       string;
  purpose:         string | null;
  scheduled?:      boolean;
}): string {
  const target = args.agentName ? `the "${args.agentName}" agent` : `a generic Claude Code agent`;
  const lead   = args.scheduled
    ? `Scheduled run — dispatch ${target}`
    : `Dispatch ${target}`;
  return (
    `${lead} for ${businessContextLine(args.business)}. Role: ${args.roleLabel}.` +
    `${args.purpose ? ` Purpose: ${args.purpose}.` : ""}` +
    ` Run it now with the business context above as grounding. Return the session id when dispatched.` +
    artifactTagInstructions(args.business.id, args.businessAgentId)
  );
}
