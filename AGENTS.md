<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
