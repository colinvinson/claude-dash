// Bridge between Jarvis chat tools and `claude agents` — the Claude Code agent runtime.
// Every helper here shells out to the `claude` CLI through the Tauri shell plugin,
// so these only work inside the desktop app (browser callers get null).
//
// Definitions live in <repo>/.claude/agents/<name>.md (Anthropic convention);
// runtime state lives in ~/.claude/jobs/<id>/ (managed by CC's supervisor).

import { runShell, readFile, writeFile, listDir, isTauri } from "@/lib/tauri/bridge";
import { Command } from "@tauri-apps/plugin-shell";

// Where the user keeps the rowan-dashboard checkout. CC must run from here so
// it picks up `.claude/agents/*.md` and any project-scoped settings.
// TODO(later): make this user-configurable instead of hard-coded.
const REPO_ROOT = "/Users/colinvinson/rowan-dashboard";
const AGENTS_DIR = `${REPO_ROOT}/.claude/agents`;

export type CCDispatchResult = {
  sessionId: string | null;
  output: string;
  ok: boolean;
};

export type CCAgentSummary = {
  id: string;
  name: string;
  state: string;     // working | needs-input | idle | completed | failed | stopped
  activity: string;  // short human description from CC's haiku-summarizer
  lastChanged: string;
};

// ============================================================
// Dispatch a new background CC session.
// `agentName` is optional — when set, CC loads the matching subagent
// from .claude/agents/<agentName>.md.
// ============================================================
export async function dispatchAgent(args: {
  agentName?: string;
  prompt: string;
}): Promise<CCDispatchResult> {
  if (!isTauri()) {
    return { sessionId: null, output: "Desktop app required to dispatch CC agents", ok: false };
  }
  const cliArgs = ["--bg"];
  if (args.agentName) {
    cliArgs.push("--agent", args.agentName);
  }
  cliArgs.push(args.prompt);

  try {
    const out = await Command.create("claude", cliArgs, { cwd: REPO_ROOT }).execute();
    if (out.code !== 0) {
      return { sessionId: null, output: out.stderr || out.stdout, ok: false };
    }
    // CC prints "backgrounded · <id>" on success
    const match = out.stdout.match(/backgrounded\s*[·•]\s*([a-f0-9]+)/i);
    const sessionId = match ? match[1] : null;
    return { sessionId, output: out.stdout, ok: true };
  } catch (err) {
    return { sessionId: null, output: (err as Error).message, ok: false };
  }
}

// ============================================================
// List active CC sessions. Best-effort parse of `claude agents` table output.
// Returns one summary row per running/needs-input session.
// ============================================================
export async function listAgents(): Promise<CCAgentSummary[]> {
  if (!isTauri()) return [];
  const out = await runShell("claude", ["agents", "--json"]);
  if (!out) return [];
  // Try JSON first (newer CC versions support --json); fall back to text parse if not.
  if (out.code === 0 && out.stdout.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(out.stdout) as Array<Record<string, unknown>>;
      return arr.map((row) => ({
        id: String(row.id ?? ""),
        name: String(row.name ?? row.title ?? ""),
        state: String(row.state ?? "unknown"),
        activity: String(row.activity ?? row.summary ?? ""),
        lastChanged: String(row.lastChanged ?? row.updatedAt ?? ""),
      }));
    } catch { /* fall through to text parse */ }
  }
  // Text fallback: best-effort parse — CC's table format isn't a stable contract,
  // so this may miss rows on UI changes. We surface a coarse "see terminal" message.
  return [];
}

// ============================================================
// Retrieve the recent output of a CC session by id.
// ============================================================
export async function agentLogs(sessionId: string, opts?: { tailLines?: number }): Promise<string> {
  if (!isTauri()) return "Desktop app required";
  const out = await runShell("claude", ["logs", sessionId]);
  if (!out) return "Failed to fetch logs";
  const text = out.stdout || out.stderr || "(no output)";
  if (opts?.tailLines) {
    return text.split("\n").slice(-opts.tailLines).join("\n");
  }
  return text;
}

// ============================================================
// Stop a running CC session.
// ============================================================
export async function stopAgent(sessionId: string): Promise<{ ok: boolean; output: string }> {
  if (!isTauri()) return { ok: false, output: "Desktop app required" };
  const out = await runShell("claude", ["stop", sessionId]);
  if (!out) return { ok: false, output: "Shell exec failed" };
  return { ok: out.code === 0, output: out.stdout || out.stderr };
}

// ============================================================
// Define a new agent — write a markdown file to .claude/agents/<name>.md.
// The agent is immediately available for dispatch (CC reloads from disk on each run).
// ============================================================
export async function defineAgent(args: {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: string[] | "*";
  model?: "sonnet" | "opus" | "haiku" | string;
  permissionMode?: "default" | "auto" | "bypassPermissions";
  isolation?: "worktree" | "none";
}): Promise<{ ok: boolean; path: string; error?: string }> {
  if (!isTauri()) {
    return { ok: false, path: "", error: "Desktop app required" };
  }
  // Light validation — agent names map to filenames, so keep them filesystem-safe.
  const safe = args.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!safe) return { ok: false, path: "", error: "invalid agent name" };
  const path = `${AGENTS_DIR}/${safe}.md`;

  const fm: string[] = [
    "---",
    `name: ${safe}`,
    `description: ${args.description.replace(/\n/g, " ")}`,
  ];
  if (args.tools) {
    fm.push(`tools: ${Array.isArray(args.tools) ? JSON.stringify(args.tools) : args.tools}`);
  }
  if (args.model) fm.push(`model: ${args.model}`);
  if (args.permissionMode) fm.push(`permissionMode: ${args.permissionMode}`);
  if (args.isolation) fm.push(`isolation: ${args.isolation}`);
  fm.push("---", "");

  const body = `${fm.join("\n")}${args.systemPrompt.trim()}\n`;
  const ok = await writeFile(path, body);
  return ok ? { ok: true, path } : { ok: false, path, error: "writeFile failed" };
}

// ============================================================
// List defined agents (the markdown files), independent of whether they're running.
// ============================================================
export async function listDefinedAgents(): Promise<Array<{ name: string; description: string }>> {
  if (!isTauri()) return [];
  const files = await listDir(AGENTS_DIR);
  if (!files) return [];
  const out: Array<{ name: string; description: string }> = [];
  for (const f of files) {
    if (!f.endsWith(".md") || f.startsWith("_") || f === "README.md") continue;
    const content = await readFile(`${AGENTS_DIR}/${f}`);
    if (!content) continue;
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*(.+)$/m);
    out.push({
      name: nameMatch ? nameMatch[1].trim() : f.replace(/\.md$/, ""),
      description: descMatch ? descMatch[1].trim() : "",
    });
  }
  return out;
}

// ============================================================
// Read the full markdown definition for an agent (so Jarvis can edit / inspect).
// ============================================================
export async function readAgentDefinition(name: string): Promise<string | null> {
  if (!isTauri()) return null;
  const safe = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return readFile(`${AGENTS_DIR}/${safe}.md`);
}
