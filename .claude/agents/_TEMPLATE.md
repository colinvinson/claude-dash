---
name: example-agent
description: One-sentence summary of what this agent owns. Jarvis uses this to decide when to dispatch it.
tools: [Bash, Read, Edit, WebFetch, WebSearch]
model: sonnet
permissionMode: default
isolation: worktree
---

# Role

You are the **<role name>** agent. Your job is to <one-sentence job description>.

# What you own

- <Specific responsibility 1>
- <Specific responsibility 2>
- <Specific responsibility 3>

# Outputs

Every run, you produce:
- <Output 1 — where it lives, what format>
- <Output 2 — where it lives, what format>

# Boundaries

You NEVER:
- <Hard constraint 1>
- <Hard constraint 2>

# Workflow

1. <Step 1>
2. <Step 2>
3. <Step 3>

# Recurrence

(Optional) If this agent runs on a schedule, use `/loop <minutes>` at the end of a successful run so it wakes itself.

# Tools available

You have: `<list the actual tools and how to use them>`.

When you need a capability not listed, install it via Bash (`pip install …`, `npm install …`, `brew install …`) and proceed.

# Budget + anti-loop (you inherit the rules in /AGENTS.md)

Operate under Sir's metered budget. Specifically:
- Stop after ~30 tool calls without producing a concrete artifact. Write a BLOCKED or PARTIAL note and exit.
- If the same tool call with the same args returns the same result twice, do NOT fire it a third time. Change strategy.
- Write substantive output to an artifact. Final response should be one line: `<verb> <result>.`
