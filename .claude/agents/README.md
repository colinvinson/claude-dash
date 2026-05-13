# Jarvis Agents — Framework

This is the directory where you define **autonomous business agents** that Jarvis can deploy.

Each agent is one markdown file: `<name>.md`. Claude Code (`claude agents`) picks them up automatically when run from this repo. Jarvis chat can dispatch, list, monitor, and stop them through the desktop app's native tool surface.

---

## How to define an agent

Create a new file at `.claude/agents/<your-agent-name>.md` using the structure in [`_TEMPLATE.md`](./_TEMPLATE.md):

```markdown
---
name: my-agent-name
description: One-line summary of what this agent does. Jarvis uses this to route work.
tools: [Bash, Read, Edit, WebFetch, WebSearch]    # or "*" for everything
model: sonnet                                      # or opus, haiku, or a full model id
permissionMode: default                            # or auto / bypassPermissions
isolation: worktree                                # optional — give it its own git worktree
---

System prompt body. Treat this like the agent's job description.
Tell it:
- What it owns (e.g. "you are responsible for daily competitive research in vertical X")
- What it should NEVER do
- What outputs are expected (artifacts, files, PRs)
- Recurring schedule if any (use `/loop <minutes>` inside the agent's session)
```

---

## How agents get deployed

Three paths, all backed by Claude Code's `claude agents`:

### 1. From Jarvis chat (desktop only)

Talk to Jarvis in the desktop app:

> "Jarvis, deploy the upwork-proposer agent on the last 10 Python gigs."

Jarvis fires the `cc_run_agent` native tool, which shells out to `claude --bg --agent upwork-proposer "..."` and returns the session id.

### 2. From the terminal

```bash
cd ~/rowan-dashboard
claude --bg --agent <agent-name> "<initial prompt>"
```

Or open agent view directly:

```bash
claude agents
```

### 3. From inside another agent

Agents can dispatch sibling agents via subagent invocation. See [Anthropic's docs on subagents](https://code.claude.com/docs/en/sub-agents).

---

## Monitoring + control

| Action | How |
|---|---|
| List all running agents | `claude agents` (terminal) — or ask Jarvis ("what's running?") |
| See an agent's output | `claude logs <id>` — or "Jarvis, show me what the upwork agent did" |
| Stop an agent | `claude stop <id>` — or "Jarvis, kill the upwork agent" |
| Resume after sleep | `claude respawn --all` |
| Schedule recurring runs | Inside the agent, use `/loop <minutes>` |

Sessions survive terminal close but **stop on machine sleep/shutdown**. For always-on cloud execution, use [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web).

---

## What goes in this directory (and what doesn't)

✅ **YES** — anything you'd genuinely deploy:
- Domain-specific research agents (e.g. "monitor Roblox trends daily, write report")
- Lead-gen agents (e.g. "scrape Upwork gigs in domain X, draft proposals")
- Content factories (e.g. "draft 5 newsletter posts from this week's news")
- Code agents (e.g. "review PRs on repo Y, suggest improvements")
- Personal admin (e.g. "summarize unread Gmail, queue replies")

❌ **NO** — these belong in Jarvis chat, not as agents:
- One-shot questions
- Personal logging (water, protein, mood, etc — Jarvis handles those directly via tools)
- Things you'd do in under 30 seconds

Rule of thumb: if the task takes more than one Claude turn, repeats on a schedule, or runs while you're away — it's an agent.

---

## Available tools per agent

Inside the agent's system prompt, you control its tool surface via the `tools:` frontmatter field.

Common values:
- `*` — everything CC can do (Bash, Read, Edit, Web, MCP servers)
- `[Bash, Read, Edit]` — local code work only
- `[WebFetch, WebSearch]` — research only, no system access
- `[Bash, Read, Edit, WebFetch, WebSearch]` — general business agent

For browser automation, instruct the agent to `pip install playwright` and use it via Bash. (We may bundle a Playwright skill later.)

---

## Where things live

| Path | Contents |
|---|---|
| `.claude/agents/<name>.md` | Agent definition (this folder) |
| `~/.claude/jobs/<id>/state.json` | Per-session runtime state (managed by CC) |
| `~/.claude/daemon.log` | Supervisor process log |
| `.claude/worktrees/` | Isolated worktrees CC creates per session for file edits |

The supervisor process is auto-managed — you don't touch it directly.

---

## Quick reference: starting from scratch

1. Copy `_TEMPLATE.md` to `<your-name>.md` and fill it in.
2. From Jarvis: "Deploy the `<your-name>` agent."
3. From terminal: `claude --bg --agent <your-name> "<task>"`
4. Watch: `claude agents`
