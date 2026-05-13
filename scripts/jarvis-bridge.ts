#!/usr/bin/env tsx
// Jarvis local bridge daemon.
//
// What it does
//   Subscribes to Supabase Realtime on the `jarvis_cc_dispatches` table.
//   When the web app inserts a new pending row, this daemon:
//     1. Marks it `running`
//     2. Maps `kind` → a `claude` CLI invocation (or a filesystem op for define/read)
//     3. Spawns the process, captures stdout/stderr/exit-code
//     4. Writes the result back into the row
//   Web clients await the UPDATE via Realtime filter and get a result like the
//   Tauri shell already gives them.
//
// How to run
//   npm run bridge
//
// Required env (loaded from .env.local in repo root)
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (server-side key — bypasses RLS; single-user app, fine)
// Optional env
//   JARVIS_REPO_ROOT            (defaults to cwd) — where .claude/agents/ lives
//   CLAUDE_BIN                  (defaults to "claude") — absolute path to CLI

import { createClient } from "@supabase/supabase-js";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

// Eagerly load .env.local so the user doesn't have to source it manually.
import "dotenv/config";
import dotenv from "dotenv";
import { existsSync } from "fs";
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REPO_ROOT    = process.env.JARVIS_REPO_ROOT ?? process.cwd();
const CLAUDE_BIN   = process.env.CLAUDE_BIN ?? "claude";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[jarvis-bridge] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type DispatchRow = {
  id: string;
  user_id: string;
  kind: "run" | "list" | "logs" | "stop" | "define" | "list_defined" | "read";
  payload: Record<string, unknown>;
  status: string;
};

type CmdResult = { stdout: string; stderr: string; code: number };

function execClaude(args: string[]): Promise<CmdResult> {
  return new Promise((resolve) => {
    const proc = spawn(CLAUDE_BIN, args, { cwd: REPO_ROOT });
    let stdout = "", stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) => { resolve({ stdout, stderr: stderr + err.message, code: 1 }); });
    proc.on("close", (code) => { resolve({ stdout, stderr, code: code ?? 1 }); });
  });
}

const AGENTS_DIR = path.join(REPO_ROOT, ".claude", "agents");

async function readDefinedAgents(): Promise<Array<{ name: string; description: string }>> {
  try {
    const files = await fs.readdir(AGENTS_DIR);
    const out: Array<{ name: string; description: string }> = [];
    for (const f of files) {
      if (!f.endsWith(".md") || f.startsWith("_") || f === "README.md") continue;
      const content = await fs.readFile(path.join(AGENTS_DIR, f), "utf-8");
      const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? f.replace(/\.md$/, "");
      const description = content.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
      out.push({ name, description });
    }
    return out;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function defineAgent(payload: Record<string, unknown>): Promise<string> {
  const name = String(payload.name ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!name) throw new Error("invalid agent name");
  await fs.mkdir(AGENTS_DIR, { recursive: true });
  const filePath = path.join(AGENTS_DIR, `${name}.md`);

  const fm: string[] = ["---", `name: ${name}`, `description: ${String(payload.description ?? "").replace(/\n/g, " ")}`];
  if (payload.tools) {
    fm.push(`tools: ${Array.isArray(payload.tools) ? JSON.stringify(payload.tools) : payload.tools}`);
  }
  if (payload.model) fm.push(`model: ${String(payload.model)}`);
  if (payload.permissionMode) fm.push(`permissionMode: ${String(payload.permissionMode)}`);
  if (payload.isolation) fm.push(`isolation: ${String(payload.isolation)}`);
  fm.push("---", "");

  await fs.writeFile(filePath, `${fm.join("\n")}${String(payload.systemPrompt ?? "").trim()}\n`);
  return filePath;
}

async function readAgentDefinition(name: string): Promise<string> {
  const safe = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return fs.readFile(path.join(AGENTS_DIR, `${safe}.md`), "utf-8");
}

async function handle(row: DispatchRow): Promise<void> {
  await supabase.from("jarvis_cc_dispatches").update({ status: "running" }).eq("id", row.id);

  try {
    let result: Record<string, unknown>;
    switch (row.kind) {
      case "run": {
        const args = ["--bg"];
        if (row.payload.agentName) args.push("--agent", String(row.payload.agentName));
        args.push(String(row.payload.prompt ?? ""));
        const r = await execClaude(args);
        const match = r.stdout.match(/backgrounded\s*[·•]\s*([a-f0-9]+)/i);
        result = { sessionId: match?.[1] ?? null, output: r.stdout || r.stderr, code: r.code };
        break;
      }
      case "list": {
        const r = await execClaude(["agents", "--json"]);
        try {
          const parsed = JSON.parse(r.stdout.trim());
          result = { sessions: parsed };
        } catch {
          result = { sessions: [], rawOutput: r.stdout };
        }
        break;
      }
      case "logs": {
        const r = await execClaude(["logs", String(row.payload.sessionId ?? "")]);
        result = { output: r.stdout || r.stderr };
        break;
      }
      case "stop": {
        const r = await execClaude(["stop", String(row.payload.sessionId ?? "")]);
        result = { ok: r.code === 0, output: r.stdout || r.stderr };
        break;
      }
      case "define": {
        const filePath = await defineAgent(row.payload);
        result = { path: filePath };
        break;
      }
      case "list_defined": {
        result = { agents: await readDefinedAgents() };
        break;
      }
      case "read": {
        result = { content: await readAgentDefinition(String(row.payload.name ?? "")) };
        break;
      }
      default:
        throw new Error(`unknown kind: ${row.kind}`);
    }

    await supabase.from("jarvis_cc_dispatches")
      .update({ status: "done", result, completed_at: new Date().toISOString() })
      .eq("id", row.id);
    console.log(`[jarvis-bridge] ${row.kind} ${row.id} → done`);
  } catch (err) {
    const msg = (err as Error).message;
    await supabase.from("jarvis_cc_dispatches")
      .update({ status: "error", error: msg, completed_at: new Date().toISOString() })
      .eq("id", row.id);
    console.error(`[jarvis-bridge] ${row.kind} ${row.id} → error: ${msg}`);
  }
}

async function main() {
  console.log(`[jarvis-bridge] starting`);
  console.log(`[jarvis-bridge]   repo:  ${REPO_ROOT}`);
  console.log(`[jarvis-bridge]   claude:${CLAUDE_BIN}`);
  console.log(`[jarvis-bridge]   sup:   ${SUPABASE_URL}`);

  // Drain any pending rows that were inserted before we connected.
  const { data: pending } = await supabase
    .from("jarvis_cc_dispatches")
    .select("*")
    .eq("status", "pending");
  if (pending && pending.length > 0) {
    console.log(`[jarvis-bridge] draining ${pending.length} pending row(s)`);
    for (const row of pending) await handle(row as DispatchRow);
  }

  // Realtime subscription for new INSERTs.
  supabase
    .channel("jarvis_cc_dispatches_bridge")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "jarvis_cc_dispatches" },
      (payload) => { void handle(payload.new as DispatchRow); },
    )
    .subscribe((status) => {
      console.log(`[jarvis-bridge] realtime: ${status}`);
    });
}

main().catch((err) => {
  console.error("[jarvis-bridge] fatal:", err);
  process.exit(1);
});
