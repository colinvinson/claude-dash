// Bridge between Jarvis chat tools and `claude agents` — the Claude Code agent runtime.
//
// Two code paths, same public API:
//   * Inside Tauri desktop shell → shell out to `claude` directly via the Tauri shell plugin (fast)
//   * Plain browser PWA          → write a row to `jarvis_cc_dispatches` and wait for
//                                  the local bridge daemon (scripts/jarvis-bridge.ts)
//                                  to execute it on the user's Mac. Result returns via
//                                  Supabase Realtime UPDATE event.
//
// Definitions live in <repo>/.claude/agents/<name>.md (Anthropic convention);
// runtime state lives in ~/.claude/jobs/<id>/ (managed by CC's supervisor).

import { runShell, readFile, writeFile, listDir, isTauri } from "@/lib/tauri/bridge";
import { Command } from "@tauri-apps/plugin-shell";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

// Where the user keeps the rowan-dashboard checkout. CC must run from here so
// it picks up `.claude/agents/*.md` and any project-scoped settings.
// TODO(later): make this user-configurable instead of hard-coded.
const REPO_ROOT = "/Users/colinvinson/rowan-dashboard";
const AGENTS_DIR = `${REPO_ROOT}/.claude/agents`;

// ============================================================
// Web fallback — write a dispatch row, await the bridge daemon's reply via Realtime.
// ============================================================

type DispatchKind = "run" | "list" | "logs" | "stop" | "define" | "list_defined" | "read";

async function dispatchViaSupabase<T extends Record<string, unknown>>(
  kind: DispatchKind,
  payload: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<{ ok: boolean; result?: T; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "browser only" };
  const supabase = createSupabaseBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  const { data: row, error: insErr } = await supabase
    .from("jarvis_cc_dispatches")
    .insert({ user_id: user.id, kind, payload })
    .select("id")
    .single();
  if (insErr || !row) return { ok: false, error: insErr?.message ?? "insert failed" };
  const rowId = row.id;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      void channel.unsubscribe();
      resolve({ ok: false, error: "timeout — is the bridge daemon running? (`npm run bridge`)" });
    }, timeoutMs);

    const channel = supabase
      .channel(`dispatch_${rowId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jarvis_cc_dispatches", filter: `id=eq.${rowId}` },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as { status: string; result: T | null; error: string | null };
          if (updated.status === "done") {
            clearTimeout(timer);
            void channel.unsubscribe();
            resolve({ ok: true, result: updated.result ?? ({} as T) });
          } else if (updated.status === "error") {
            clearTimeout(timer);
            void channel.unsubscribe();
            resolve({ ok: false, error: updated.error ?? "bridge error" });
          }
        },
      )
      .subscribe();
  });
}

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
// Tauri direct-shell helpers (fast path inside the desktop app)
// ============================================================

async function tauriDispatch(agentName: string | undefined, prompt: string): Promise<CCDispatchResult> {
  const cliArgs = ["--bg"];
  if (agentName) cliArgs.push("--agent", agentName);
  cliArgs.push(prompt);
  try {
    const out = await Command.create("claude", cliArgs, { cwd: REPO_ROOT }).execute();
    if (out.code !== 0) return { sessionId: null, output: out.stderr || out.stdout, ok: false };
    const match = out.stdout.match(/backgrounded\s*[·•]\s*([a-f0-9]+)/i);
    return { sessionId: match?.[1] ?? null, output: out.stdout, ok: true };
  } catch (err) {
    return { sessionId: null, output: (err as Error).message, ok: false };
  }
}

// ============================================================
// Public API — each call picks Tauri or web path automatically.
// ============================================================

export async function dispatchAgent(args: {
  agentName?: string;
  prompt: string;
}): Promise<CCDispatchResult> {
  if (isTauri()) return tauriDispatch(args.agentName, args.prompt);
  const r = await dispatchViaSupabase<{ sessionId: string | null; output: string; code: number }>(
    "run",
    { agentName: args.agentName, prompt: args.prompt },
    60_000,
  );
  if (!r.ok) return { sessionId: null, output: r.error ?? "dispatch failed", ok: false };
  return {
    sessionId: r.result?.sessionId ?? null,
    output: r.result?.output ?? "",
    ok: (r.result?.code ?? 0) === 0,
  };
}

export async function listAgents(): Promise<CCAgentSummary[]> {
  if (isTauri()) {
    const out = await runShell("claude", ["agents", "--json"]);
    if (!out || out.code !== 0) return [];
    try {
      const arr = JSON.parse(out.stdout) as Array<Record<string, unknown>>;
      return arr.map((row) => ({
        id: String(row.id ?? ""),
        name: String(row.name ?? row.title ?? ""),
        state: String(row.state ?? "unknown"),
        activity: String(row.activity ?? row.summary ?? ""),
        lastChanged: String(row.lastChanged ?? row.updatedAt ?? ""),
      }));
    } catch { return []; }
  }
  const r = await dispatchViaSupabase<{ sessions: Array<Record<string, unknown>> }>("list", {});
  if (!r.ok || !r.result?.sessions) return [];
  return r.result.sessions.map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? row.title ?? ""),
    state: String(row.state ?? "unknown"),
    activity: String(row.activity ?? row.summary ?? ""),
    lastChanged: String(row.lastChanged ?? row.updatedAt ?? ""),
  }));
}

export async function agentLogs(sessionId: string, opts?: { tailLines?: number }): Promise<string> {
  let text = "";
  if (isTauri()) {
    const out = await runShell("claude", ["logs", sessionId]);
    text = out ? (out.stdout || out.stderr || "(no output)") : "Failed to fetch logs";
  } else {
    const r = await dispatchViaSupabase<{ output: string }>("logs", { sessionId });
    text = r.ok ? (r.result?.output ?? "(no output)") : (r.error ?? "Failed to fetch logs");
  }
  if (opts?.tailLines) text = text.split("\n").slice(-opts.tailLines).join("\n");
  return text;
}

export async function stopAgent(sessionId: string): Promise<{ ok: boolean; output: string }> {
  if (isTauri()) {
    const out = await runShell("claude", ["stop", sessionId]);
    if (!out) return { ok: false, output: "Shell exec failed" };
    return { ok: out.code === 0, output: out.stdout || out.stderr };
  }
  const r = await dispatchViaSupabase<{ ok: boolean; output: string }>("stop", { sessionId });
  if (!r.ok) return { ok: false, output: r.error ?? "stop failed" };
  return { ok: !!r.result?.ok, output: r.result?.output ?? "" };
}

export async function defineAgent(args: {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: string[] | "*";
  model?: "sonnet" | "opus" | "haiku" | string;
  permissionMode?: "default" | "auto" | "bypassPermissions";
  isolation?: "worktree" | "none";
}): Promise<{ ok: boolean; path: string; error?: string }> {
  const safe = args.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!safe) return { ok: false, path: "", error: "invalid agent name" };

  if (isTauri()) {
    const path = `${AGENTS_DIR}/${safe}.md`;
    const fm: string[] = ["---", `name: ${safe}`, `description: ${args.description.replace(/\n/g, " ")}`];
    if (args.tools) fm.push(`tools: ${Array.isArray(args.tools) ? JSON.stringify(args.tools) : args.tools}`);
    if (args.model) fm.push(`model: ${args.model}`);
    if (args.permissionMode) fm.push(`permissionMode: ${args.permissionMode}`);
    if (args.isolation) fm.push(`isolation: ${args.isolation}`);
    fm.push("---", "");
    const ok = await writeFile(path, `${fm.join("\n")}${args.systemPrompt.trim()}\n`);
    return ok ? { ok: true, path } : { ok: false, path, error: "writeFile failed" };
  }

  const r = await dispatchViaSupabase<{ path: string }>("define", {
    name: safe,
    description: args.description,
    systemPrompt: args.systemPrompt,
    tools: args.tools,
    model: args.model,
    permissionMode: args.permissionMode,
    isolation: args.isolation,
  });
  if (!r.ok) return { ok: false, path: "", error: r.error ?? "define failed" };
  return { ok: true, path: r.result?.path ?? "" };
}

export async function listDefinedAgents(): Promise<Array<{ name: string; description: string }>> {
  if (isTauri()) {
    const files = await listDir(AGENTS_DIR);
    if (!files) return [];
    const out: Array<{ name: string; description: string }> = [];
    for (const f of files) {
      if (!f.endsWith(".md") || f.startsWith("_") || f === "README.md") continue;
      const content = await readFile(`${AGENTS_DIR}/${f}`);
      if (!content) continue;
      out.push({
        name: content.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? f.replace(/\.md$/, ""),
        description: content.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "",
      });
    }
    return out;
  }
  const r = await dispatchViaSupabase<{ agents: Array<{ name: string; description: string }> }>("list_defined", {});
  return r.ok && r.result?.agents ? r.result.agents : [];
}

export async function readAgentDefinition(name: string): Promise<string | null> {
  const safe = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (isTauri()) return readFile(`${AGENTS_DIR}/${safe}.md`);
  const r = await dispatchViaSupabase<{ content: string }>("read", { name: safe });
  return r.ok ? (r.result?.content ?? null) : null;
}
