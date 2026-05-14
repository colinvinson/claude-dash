// Tool definitions for Jarvis chat — Anthropic tool use schemas + server-side executors.
// Each tool maps to ONE specific Supabase mutation, scoped to the authenticated user.

import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";

export type ToolResult = { ok: true; message: string } | { ok: false; error: string };

function getLogDate() {
  const now = new Date();
  if (now.getHours() < 6) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return y.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

export const LOG_TOOLS: Anthropic.Tool[] = [
  {
    name: "complete_goal",
    description: "Mark one of today's goals as complete. Use when the user reports finishing a goal in conversation.",
    input_schema: {
      type: "object" as const,
      properties: { goal_title: { type: "string", description: "Substring of the goal title to match (case-insensitive)" } },
      required: ["goal_title"],
    },
  },
  {
    name: "log_supplement",
    description: "Mark a supplement as taken today. Use when the user says they took a supplement.",
    input_schema: {
      type: "object" as const,
      properties: { supplement_name: { type: "string", description: "Substring of the supplement name (case-insensitive)" } },
      required: ["supplement_name"],
    },
  },
  {
    name: "log_water",
    description: "Increment today's water glass count by 1.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "log_meditation",
    description: "Log a meditation session today.",
    input_schema: {
      type: "object" as const,
      properties: { duration_min: { type: "number", description: "Minutes meditated" } },
      required: ["duration_min"],
    },
  },
  {
    name: "log_concerta",
    description: "Mark Concerta as taken today.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "log_protein",
    description: "Log a protein entry (just the grams, like a manual entry). Use when user reports a meal.",
    input_schema: {
      type: "object" as const,
      properties: {
        grams: { type: "number", description: "Protein in grams" },
        food_name: { type: "string", description: "Short name of the food (optional)" },
      },
      required: ["grams"],
    },
  },
  {
    name: "mark_prayed",
    description: "Mark today's prayer as done.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "mark_bible",
    description: "Add bible reading minutes for today (additive — adds to existing total).",
    input_schema: {
      type: "object" as const,
      properties: { minutes: { type: "number" } },
      required: ["minutes"],
    },
  },
  {
    name: "mark_church",
    description: "Mark church attendance for today.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "log_mood",
    description: "Log the user's current mood on a 1-5 scale (1 worst, 5 best).",
    input_schema: {
      type: "object" as const,
      properties: { score: { type: "number", minimum: 1, maximum: 5 } },
      required: ["score"],
    },
  },
  {
    name: "log_alcohol",
    description: "Log an alcoholic drink (beer/wine/spirits/cocktail).",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Beer | Wine | Spirits | Cocktail" },
        count: { type: "number", description: "How many drinks (default 1)" },
      },
      required: ["type"],
    },
  },
  {
    name: "log_weight",
    description: "Log the user's current bodyweight in kg.",
    input_schema: {
      type: "object" as const,
      properties: { kg: { type: "number" } },
      required: ["kg"],
    },
  },
];

// ============================================================
// Jarvis-only tools — memory + worker orchestration
// ============================================================

export const JARVIS_EXTRA_TOOLS: Anthropic.Tool[] = [
  {
    name: "remember_fact",
    description: "Persist a durable fact about Sir (preferences, skills, goals, context) so you can recall it in future conversations.",
    input_schema: {
      type: "object" as const,
      properties: {
        fact: { type: "string", description: "A concise factual statement, e.g. 'Sir prefers morning lifts at Les Roches gym.'" },
        confidence: { type: "number", description: "0-1, how sure you are. Default 0.8." },
      },
      required: ["fact"],
    },
  },
  {
    name: "recall_facts",
    description: "Search persisted facts about Sir. Returns up to 10 matching facts. Use when Sir references something he's told you before.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Free-text query — matched as substring against stored facts." } },
      required: ["query"],
    },
  },
  {
    name: "open_url",
    description: "Open a URL in a new browser tab on Sir's device. Use this to show him a webpage, dashboard, or document.",
    input_schema: {
      type: "object" as const,
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },

  // ── Primitive capability tools — let workers do real work ───────
  {
    name: "fetch_url",
    description: "GET (or POST/etc) a URL and return the response body as text. Use for scraping pages, polling APIs, checking external services. Response truncated to 80KB. Blocks private/internal IPs.",
    input_schema: {
      type: "object" as const,
      properties: {
        url:     { type: "string", description: "Full URL to fetch." },
        method:  { type: "string", description: "HTTP method. Default GET." },
        headers: { type: "object", description: "Optional headers as a flat object." },
        body:    { type: "string", description: "Optional request body for POST/PUT/PATCH." },
      },
      required: ["url"],
    },
  },
  {
    name: "web_search",
    description: "Search the web via Tavily. Returns top results with title, URL, and content snippet. Use for market research, trend analysis, finding sources. Requires TAVILY_API_KEY.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:       { type: "string" },
        max_results: { type: "number", description: "Default 5, max 10." },
      },
      required: ["query"],
    },
  },
  {
    name: "write_artifact",
    description: "Save a substantial output (blog post, plan, report, research, code, anything text). Returns the artifact id. Use for any output that should persist beyond this conversation.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:    { type: "string", description: "Short title for the artifact." },
        content: { type: "string" },
        type:    { type: "string", description: "markdown | text | json | html. Default markdown." },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "list_artifacts",
    description: "List the most recent artifacts. Returns names + ids + types + dates so you can reference or read them.",
    input_schema: {
      type: "object" as const,
      properties: { limit: { type: "number", description: "Default 20." } },
    },
  },
  {
    name: "read_artifact",
    description: "Read the full content of an artifact by id or name substring.",
    input_schema: {
      type: "object" as const,
      properties: { id_or_name: { type: "string" } },
      required: ["id_or_name"],
    },
  },
];

export const ALL_JARVIS_TOOLS: Anthropic.Tool[] = [...LOG_TOOLS, ...JARVIS_EXTRA_TOOLS];

// ============================================================
// CLIENT-EXECUTED tools — the server never runs these. When Claude
// calls one, the chat route emits a pendingNative SSE event and the
// client picks up the execution.
//
// Two subgroups (the server doesn't care about the split — it's the
// CLIENT that picks how to execute each):
//
//   OS_NATIVE_TOOLS   → screenshots, mouse, keyboard, shell, filesystem
//                       Require the Tauri desktop app — no browser fallback.
//                       Stripped from the toolset when the client is a regular browser.
//
//   CC_NATIVE_TOOLS   → Claude Code agent runtime (dispatch / list / logs / stop / define)
//                       Work in BOTH environments: Tauri shells directly,
//                       browser writes to `jarvis_cc_dispatches` for the local
//                       bridge daemon (scripts/jarvis-bridge.ts) to execute.
//                       Always included in the toolset; if the bridge isn't running
//                       the call surfaces a clean timeout error.
// ============================================================

export const OS_NATIVE_TOOLS: Anthropic.Tool[] = [
  {
    name: "take_screenshot",
    description: "Capture the user's primary display and look at it. Use this whenever the user asks about something on their screen, references 'this' or 'that', or you need visual context to help with a UI task. The screenshot is returned to you as an image you can actually see.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "mouse_click",
    description: "Click at absolute screen coordinates (x, y) on the primary display. Use after take_screenshot so you know what's where. Always prefer keyboard shortcuts when the same action exists — clicking is fragile across resolutions.",
    input_schema: {
      type: "object" as const,
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        button: { type: "string", enum: ["left", "right", "middle"], description: "Default: left" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "keyboard_type",
    description: "Type text at the current focus. Use for filling fields, writing code, composing messages.",
    input_schema: {
      type: "object" as const,
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "keyboard_key",
    description: "Press a key or combo. Examples: 'enter', 'tab', 'cmd+s', 'cmd+shift+a', 'escape', 'f5'. Use cmd (not ctrl) on macOS.",
    input_schema: {
      type: "object" as const,
      properties: { combo: { type: "string" } },
      required: ["combo"],
    },
  },
  {
    name: "run_shell",
    description: "Execute a program on Sir's machine. Returns stdout, stderr, and exit code. For git, npm, brew, python, node, ls, cat, open, etc. Be specific — these commands run against his actual filesystem.",
    input_schema: {
      type: "object" as const,
      properties: {
        program: { type: "string", description: "Executable name or absolute path" },
        args: { type: "array", items: { type: "string" }, description: "Arguments to pass" },
      },
      required: ["program"],
    },
  },
  {
    name: "read_file",
    description: "Read the text contents of a file on Sir's machine. Pass an absolute path.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write text contents to a file on Sir's machine (overwrites if exists). Pass an absolute path. Confirm intent before overwriting something important.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_directory",
    description: "List filenames inside a directory on Sir's machine. Pass an absolute path.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
];

export const CC_NATIVE_TOOLS: Anthropic.Tool[] = [
  {
    name: "cc_run_agent",
    description: "Deploy a background Claude Code agent to take on a real task — research, scraping, content creation, building things, posting, etc. Use this whenever Sir asks for autonomous work, NOT for one-shot questions. If `agent_name` matches a subagent defined in .claude/agents/, that subagent's system prompt + tool allowlist load automatically; otherwise a generic CC session runs with the given prompt. Returns the session id so Sir can monitor or stop it later.",
    input_schema: {
      type: "object" as const,
      properties: {
        agent_name: { type: "string", description: "Optional. Name of a subagent defined under .claude/agents/. Omit for a generic session." },
        prompt: { type: "string", description: "The task or instructions for the agent. Be specific about the deliverable and where to save it." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "cc_list_agents",
    description: "List currently running Claude Code background agents (sessions). Returns their id, name, state, and last activity. Use this when Sir asks what's running.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "cc_agent_logs",
    description: "Fetch the recent output of a running or completed CC agent session. Use when Sir asks 'what did it do?' or wants to inspect progress.",
    input_schema: {
      type: "object" as const,
      properties: {
        session_id: { type: "string", description: "The short id printed when the agent was dispatched (also visible in `claude agents`)." },
        tail_lines: { type: "number", description: "Optional. Return only the last N lines. Default returns the full recent buffer." },
      },
      required: ["session_id"],
    },
  },
  {
    name: "cc_stop_agent",
    description: "Stop a running CC agent session by id. Use when Sir says to kill or halt an agent.",
    input_schema: {
      type: "object" as const,
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    name: "cc_define_agent",
    description: "Define a new agent — writes a markdown file to .claude/agents/<name>.md that becomes immediately dispatchable. Use this when Sir wants to set up a new kind of worker (a recurring research role, a content factory, a monitor, etc.). Do NOT use this for one-shot work — that's what cc_run_agent without an agent_name is for.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Filesystem-safe agent name (kebab-case)." },
        description: { type: "string", description: "One sentence — what this agent owns." },
        system_prompt: { type: "string", description: "Full system prompt. Be specific about job, outputs, boundaries." },
        tools: { type: "array", items: { type: "string" }, description: "Optional tool allowlist (CC tool names, e.g. ['Bash','Read','Edit','WebFetch']). Omit for full access." },
        model: { type: "string", description: "Optional. 'sonnet' | 'opus' | 'haiku' or a specific model id. Default: sonnet." },
      },
      required: ["name", "description", "system_prompt"],
    },
  },
  {
    name: "cc_list_defined_agents",
    description: "List every agent definition currently sitting in .claude/agents/ — i.e. what's available to dispatch. Independent of whether they're running.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "cc_read_agent",
    description: "Read the full markdown definition for an agent — system prompt, tools, model, everything. Use when Sir wants to inspect or edit one.",
    input_schema: {
      type: "object" as const,
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
];

// All client-executed tools, regardless of which subgroup. Used by the chat
// route to decide whether to execute server-side or yield to the client.
export const NATIVE_TOOLS: Anthropic.Tool[] = [...OS_NATIVE_TOOLS, ...CC_NATIVE_TOOLS];
export const NATIVE_TOOL_NAMES = new Set(NATIVE_TOOLS.map((t) => t.name));

// ============================================================
// Server tools (Anthropic runs these — we don't implement an executor)
// ============================================================

// Code Execution — Claude writes + runs Python in Anthropic's managed sandbox.
// Has internet access; can pip-install packages on the fly. Requires the beta
// header `anthropic-beta: code-execution-2025-08-25` on the messages.create call.
// Wrapped as `unknown` since the public `Anthropic.Tool` type doesn't include
// server tools in the stable typings yet.
export const CODE_EXECUTION_TOOL = {
  type: "code_execution_20250825",
  name: "code_execution",
} as unknown as Anthropic.Tool;

export const CODE_EXECUTION_BETA = "code-execution-2025-08-25";

// Workers are for business/project work — research, scraping, content gen, analysis.
// They explicitly do NOT get personal logging tools (log_water, log_protein, etc).
// Personal logging is a direct Jarvis chat action — instant, deterministic, no worker needed.
// Workers (now CC agents) get the full Claude Code tool surface natively — Bash, Read, Edit,
// WebFetch, WebSearch, MCP, plus anything else you grant in their `.claude/agents/<name>.md`
// frontmatter. The constants below are retained for any legacy server-tool wiring; the
// CC agent runtime ignores them.

type ToolInput = Record<string, unknown>;

export async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  input: ToolInput,
): Promise<ToolResult> {
  const today = getLogDate();

  try {
    switch (name) {
      case "complete_goal": {
        const needle = String(input.goal_title ?? "").toLowerCase();
        const { data: goals } = await supabase
          .from("goals")
          .select("id, title")
          .eq("user_id", userId)
          .eq("goal_date", today);
        const match = (goals ?? []).find((g) => g.title.toLowerCase().includes(needle));
        if (!match) return { ok: false, error: `No goal matching "${input.goal_title}" found for today` };
        await supabase.from("goals").update({ is_complete: true, completed_at: new Date().toISOString() }).eq("id", match.id);
        return { ok: true, message: `Marked "${match.title}" complete` };
      }

      case "log_supplement": {
        const needle = String(input.supplement_name ?? "").toLowerCase();
        const { data: stack } = await supabase
          .from("supplement_stack")
          .select("id, name")
          .eq("user_id", userId)
          .eq("is_active", true);
        const match = (stack ?? []).find((s) => s.name.toLowerCase().includes(needle));
        if (!match) return { ok: false, error: `No supplement matching "${input.supplement_name}"` };
        await supabase.from("supplement_logs").insert({
          user_id: userId,
          supplement_id: match.id,
          log_date: today,
          taken_at: new Date().toISOString(),
        });
        return { ok: true, message: `Logged ${match.name}` };
      }

      case "log_water": {
        const { data: existing } = await supabase
          .from("water_logs")
          .select("glasses")
          .eq("user_id", userId)
          .eq("log_date", today)
          .single();
        const next = (existing?.glasses ?? 0) + 1;
        await supabase.from("water_logs").upsert({
          user_id: userId, log_date: today, glasses: next, updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,log_date" });
        return { ok: true, message: `Water: ${next} glasses` };
      }

      case "log_meditation": {
        const min = Number(input.duration_min);
        if (!min || min <= 0) return { ok: false, error: "Invalid duration" };
        await supabase.from("meditation_logs").insert({
          user_id: userId, log_date: today, duration_min: min,
        });
        return { ok: true, message: `Logged ${min}min meditation` };
      }

      case "log_concerta": {
        await supabase.from("medication_logs").insert({
          user_id: userId, medication_type: "concerta", log_date: today, taken_at: new Date().toISOString(),
        });
        return { ok: true, message: "Concerta logged" };
      }

      case "log_protein": {
        const grams = Number(input.grams);
        if (!grams || grams <= 0) return { ok: false, error: "Invalid protein amount" };
        await supabase.from("protein_logs").insert({
          user_id: userId,
          log_date: today,
          protein_g: grams,
          food_name: (input.food_name as string) ?? null,
          source: "manual",
        });
        return { ok: true, message: `Logged ${grams}g protein${input.food_name ? ` (${input.food_name})` : ""}` };
      }

      case "mark_prayed": {
        await supabase.from("faith_logs").upsert({
          user_id: userId, log_date: today, prayed: true, updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,log_date" });
        return { ok: true, message: "Prayer marked" };
      }

      case "mark_bible": {
        const minutes = Number(input.minutes);
        if (!minutes || minutes <= 0) return { ok: false, error: "Invalid minutes" };
        const { data: existing } = await supabase
          .from("faith_logs").select("bible_min").eq("user_id", userId).eq("log_date", today).single();
        const total = (existing?.bible_min ?? 0) + minutes;
        await supabase.from("faith_logs").upsert({
          user_id: userId, log_date: today, bible_min: total, updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,log_date" });
        return { ok: true, message: `Bible: ${total}min today` };
      }

      case "mark_church": {
        await supabase.from("faith_logs").upsert({
          user_id: userId, log_date: today, church_attended: true, updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,log_date" });
        return { ok: true, message: "Church attendance marked" };
      }

      case "log_mood": {
        const score = Number(input.score);
        if (!score || score < 1 || score > 5) return { ok: false, error: "Mood must be 1-5" };
        await supabase.from("mood_logs").insert({ user_id: userId, log_date: today, score });
        const emojis = ["😞", "😐", "🙂", "😊", "🤩"];
        return { ok: true, message: `Mood logged: ${emojis[score - 1]} (${score}/5)` };
      }

      case "log_alcohol": {
        const drinkType = String(input.type ?? "Beer");
        const count = Number(input.count ?? 1);
        await supabase.from("alcohol_logs").insert({
          user_id: userId, log_date: today, drink_type: drinkType, drink_count: count,
        });
        return { ok: true, message: `Logged ${count} ${drinkType.toLowerCase()}` };
      }

      case "log_weight": {
        const kg = Number(input.kg);
        if (!kg || kg <= 0) return { ok: false, error: "Invalid weight" };
        await supabase.from("weight_logs").insert({ user_id: userId, weight_kg: kg });
        return { ok: true, message: `Logged weight: ${kg}kg` };
      }

      // ── Jarvis memory tools ────────────────────────────
      case "remember_fact": {
        const fact = String(input.fact ?? "").trim();
        if (!fact) return { ok: false, error: "Empty fact" };
        const confidence = Number(input.confidence ?? 0.8);
        const { data: existing } = await supabase
          .from("jarvis_facts").select("id, confidence").eq("user_id", userId).eq("fact", fact).maybeSingle();
        if (existing) {
          const newConf = Math.min(1, Number(existing.confidence) + 0.1);
          await supabase.from("jarvis_facts")
            .update({ confidence: newConf, last_referenced_at: new Date().toISOString() })
            .eq("id", existing.id);
          return { ok: true, message: `Reinforced: "${fact.slice(0, 60)}"` };
        }
        await supabase.from("jarvis_facts").insert({ user_id: userId, fact, source: "chat", confidence });
        return { ok: true, message: `Remembered: "${fact.slice(0, 60)}"` };
      }

      case "recall_facts": {
        const query = String(input.query ?? "").trim();
        if (!query) return { ok: false, error: "Empty query" };
        const escaped = query.replace(/[%_]/g, (m) => `\\${m}`);
        const { data: facts } = await supabase
          .from("jarvis_facts")
          .select("fact, confidence")
          .eq("user_id", userId)
          .ilike("fact", `%${escaped}%`)
          .order("confidence", { ascending: false })
          .limit(10);
        if (!facts || facts.length === 0) return { ok: true, message: `No facts matching "${query}"` };
        return { ok: true, message: facts.map((f) => `• ${f.fact}`).join("\n") };
      }

      case "open_url": {
        // Server-side: just acknowledge — actual window.open happens client-side
        // via a special SSE event in the chat stream.
        const url = String(input.url ?? "");
        if (!url) return { ok: false, error: "Empty URL" };
        return { ok: true, message: `__OPEN_URL__${url}` };
      }

      // ── Primitive capability tools ──────────────────────────
      case "fetch_url": {
        const url = String(input.url ?? "");
        if (!url) return { ok: false, error: "Empty URL" };
        // SSRF prevention: block private/internal IPs
        try {
          const parsed = new URL(url);
          const host = parsed.hostname;
          const blocked = [
            "localhost", "127.0.0.1", "0.0.0.0", "::1",
            "169.254.169.254",  // AWS instance metadata
          ];
          if (blocked.includes(host)) return { ok: false, error: "Blocked host" };
          if (/^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
            return { ok: false, error: "Private network blocked" };
          }
          if (!/^https?:$/.test(parsed.protocol)) return { ok: false, error: "Only http(s) allowed" };
        } catch {
          return { ok: false, error: "Invalid URL" };
        }

        const method  = String(input.method ?? "GET").toUpperCase();
        const headers = (input.headers as Record<string, string>) ?? {};
        const body    = (input.body as string) ?? undefined;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000);
          const res = await fetch(url, {
            method,
            headers: { "User-Agent": "JarvisWorker/1.0", ...headers },
            body: ["GET", "HEAD"].includes(method) ? undefined : body,
            signal: controller.signal,
          });
          clearTimeout(timer);
          const text = await res.text();
          const truncated = text.length > 80_000 ? text.slice(0, 80_000) + "\n…[truncated]" : text;
          return { ok: true, message: `HTTP ${res.status} ${res.statusText}\n\n${truncated}` };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "Fetch failed" };
        }
      }

      case "web_search": {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) return { ok: false, error: "TAVILY_API_KEY not configured. Set it in Vercel env vars (free tier at tavily.com)." };
        const query = String(input.query ?? "");
        if (!query) return { ok: false, error: "Empty query" };
        const maxResults = Math.min(10, Math.max(1, Number(input.max_results) || 5));

        try {
          const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: apiKey,
              query,
              max_results: maxResults,
              search_depth: "basic",
              include_answer: true,
            }),
          });
          if (!res.ok) return { ok: false, error: `Tavily ${res.status}` };
          const data = await res.json() as {
            answer?: string;
            results?: Array<{ title: string; url: string; content: string }>;
          };
          const lines: string[] = [];
          if (data.answer) lines.push(`Answer: ${data.answer}\n`);
          for (const r of data.results ?? []) {
            lines.push(`• ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 400)}`);
          }
          return { ok: true, message: lines.join("\n\n") };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "Search failed" };
        }
      }

      case "write_artifact": {
        const name    = String(input.name ?? "").trim();
        const content = String(input.content ?? "");
        const type    = String(input.type ?? "markdown");
        if (!name || !content) return { ok: false, error: "name and content required" };
        const { data, error } = await supabase.from("jarvis_artifacts").insert({
          user_id: userId, name, type, content,
        }).select("id").single();
        if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
        return { ok: true, message: `Wrote "${name}" (${type}, ${content.length} chars). id: ${data.id}` };
      }

      case "list_artifacts": {
        const limit = Math.min(50, Math.max(1, Number(input.limit) || 20));
        const { data } = await supabase
          .from("jarvis_artifacts")
          .select("id, name, type, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!data || data.length === 0) return { ok: true, message: "No artifacts yet." };
        return {
          ok: true,
          message: data.map((a) => `• ${a.name} [${a.type}] · ${new Date(a.created_at).toLocaleString()} · id ${a.id.slice(0, 8)}`).join("\n"),
        };
      }

      case "read_artifact": {
        const idOrName = String(input.id_or_name ?? "").trim();
        if (!idOrName) return { ok: false, error: "Empty id_or_name" };
        // Try exact id match first (UUIDs are 36 chars)
        let artifact: { name: string; type: string; content: string } | null = null;
        if (idOrName.length >= 8) {
          const { data } = await supabase
            .from("jarvis_artifacts")
            .select("name, type, content")
            .eq("user_id", userId)
            .eq("id", idOrName)
            .maybeSingle();
          if (data) artifact = data as { name: string; type: string; content: string };
        }
        if (!artifact) {
          // Fall back to name substring match (most recent first)
          const escaped = idOrName.replace(/[%_]/g, (m) => `\\${m}`);
          const { data } = await supabase
            .from("jarvis_artifacts")
            .select("name, type, content")
            .eq("user_id", userId)
            .ilike("name", `%${escaped}%`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) artifact = data as { name: string; type: string; content: string };
        }
        if (!artifact) return { ok: false, error: `No artifact matching "${idOrName}"` };
        return { ok: true, message: `[${artifact.name}]\n\n${artifact.content}` };
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tool execution failed" };
  }
}
