<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:tracked-data-rule -->
# Tracked data must flow into the algorithm (MANDATORY)

When you add a new logging feature, tracked field, table, or column to this dashboard, it is NOT done until ALL FIVE of the following are wired up. No exceptions. Sir's directive: "nothing is just for me to track — everything must feed the algorithm."

## The five places every new tracked field must land:

1. **`lib/ai/context-builder.ts`** — Add a parallel query for TODAY's value in the `Promise.all` block. Surface in the returned object (usually under `lifestyle`, `biometrics`, or as a top-level key). This is what Jarvis chat sees on every turn.

2. **`lib/ai/snapshot-builder.ts`** — Add a column to the 21-day CSV `Row` type and emit it in the row builder. This is what enables autonomous correlation discovery across all metrics. Use the dynamic indexer pattern (`med_<type>`, `supp_<name>`) for high-cardinality fields.

3. **`lib/scoring.ts`** — If the field is a behavior Sir is trying to improve (something with a target or a "done/not done" state), wire it into the score as a new component with self-exclusion. Don't include passive data (biometrics, weight) in scoring — only volitional behaviors.

4. **`lib/jarvis/adherence.ts`** OR **`lib/jarvis/baselines.ts`** — If it's a recurring behavior, surface streak / drift via adherence. If it's a biometric, add to baselines so Jarvis can phrase responses relative to Sir's own norm.

5. **`lib/jarvis/prompts.ts`** — Document the new context field under the "Context you have access to" section so Jarvis knows the field exists and how to phrase responses about it.

## How to verify it's wired

Before considering a tracking feature done, confirm:
- [ ] The new data appears in today's chat context (logged, then ask Jarvis "what did I log?")
- [ ] The new data appears in the 21-day snapshot CSV (check via tool or temporary log)
- [ ] If volitional, it moves the daily score on Home
- [ ] If recurring, streak/drift shows in adherence summary
- [ ] If biometric, vsBaseline is computed once there's 7+ days of history

## What NOT to add

- Don't add fields purely for "I want to see this on the dashboard later." Every tracked field has a token cost (it's in Jarvis's context every turn). Add it because the algorithm should reason over it.
- Don't add ephemeral state (UI toggles, drafts, etc.) to logged tables.
- Don't hardcode substance names or specific products in prompts / context (Concerta, Magnesium, etc.) — use generic mechanisms that work for whatever Sir actually logs.

This rule is non-negotiable. If you're tempted to skip a step "for now," you're creating tech debt that misleads Sir into thinking the algorithm sees something it doesn't.
<!-- END:tracked-data-rule -->

<!-- BEGIN:token-discipline -->
# Token discipline (mandatory for every agent run)

You are operating on Sir's metered Claude budget. Every input + output token is real money. Follow these rules without exception.

## Budget envelope per run

- Aim for **< 30 distinct tool calls** in any single dispatched run. If you cross 30, that is a signal you are looping or scoping too broadly — stop and write_artifact what you have.
- Aim for **< 50,000 input tokens** of context consumed across a run. If files / fetches / search results push you over, drop low-signal content (raw HTML, transcripts, etc.) before reading them again.
- If a run exceeds either budget without producing a concrete output, treat it as a failed run and exit with a one-line BLOCKED report instead of continuing.

## Anti-loop rules (hard, not soft)

- **Same call, same args, same result → STOP that approach.** If you've fired the same tool with the same arguments and gotten the same result twice, do not fire it a third time. Change strategy or abandon the sub-goal.
- **No silent retry storms.** If a network call, command, or compile fails the same way 3 times in a row, the problem is upstream — write_artifact a short BLOCKED note explaining what failed and exit. Do not keep trying.
- **Don't grep the same thing twice.** Before any tool call, ask: do I already have this answer in my context window? If yes, use it.
- **Don't re-read files you've already read** in the same run. Reference the prior tool result instead.

## Cheap before expensive

- Prefer `Read` and `Grep` over `WebSearch`. Prefer `WebFetch` of a known URL over `WebSearch`.
- Prefer one well-targeted search over five exploratory ones.
- Prefer running a script that does N things over making N tool calls.
- Use Haiku-class models for summarization, classification, and extraction subtasks if your subagent system supports model overrides.

## Output rules

- **Write substantive outputs to artifacts**, not into your final response. Long final responses are billed at full rate every turn.
- End every run with a one-sentence summary headline (start with a verb): `Drafted 5 proposals.` `BLOCKED: Upwork CAPTCHA.` `PARTIAL: 3 of 5 done, see artifact X.`
- If your task has subgoals, write a progress artifact every ~10 actions so a future run can resume from it instead of starting over.

## Scope boundaries

- If the user's request is ambiguous or unbounded ("make money any way"), do NOT just start. Ask one clarifying question, OR pick the narrowest tractable interpretation and state it in your first line.
- If you hit a wall that needs human input (KYC, identity, account creation, judgment call), STOP and report. Don't loop trying to bypass it.

These rules apply to every CC agent run from this repository, regardless of what its agent definition says.
<!-- END:token-discipline -->

<!-- BEGIN:design-system-reuse -->
# Design system reuse (mandatory before any UI work)

Before building or modifying any UI surface, read [components/ui/DESIGN.md](components/ui/DESIGN.md). The app went through a cohesion pass because it grew into 16 cards on Home, 4 ways to render "done," and amber meaning two different things. The DESIGN doc is the antidote.

Hard rules:

- **Reuse primitives.** `Card`, `CompletionToggle`, `FormInput` / `FormTextarea` / `FormSelect`, `FormLabel`, `EmptyState`, `ConfettiBurst`. Never hand-roll the equivalent inline.
- **Reuse tokens.** Import `PALETTE`, `TINT`, `BORDER`, `SPACING`, `TYPE` from [lib/design-tokens.ts](lib/design-tokens.ts). No hex literals in `components/` or `app/(app)/` except in `lib/schedule/icons.ts` (intentional per-item identity).
- **Each color token has ONE meaning.** Don't reuse `PALETTE.warning` for a primary action because you "wanted some color." Primary is white, secondary is bordered zinc.
- **Home is for triage**, not features. Default new features to their dedicated tab.
- **One way to render "done"** — `CompletionToggle`. If you need a new size, add a mode to it; don't fork.

If a primitive doesn't fit your case, extend the primitive (add a prop / mode) and update DESIGN.md. Forking styling is the exact thing that caused the cohesion mess this rule prevents.
<!-- END:design-system-reuse -->
