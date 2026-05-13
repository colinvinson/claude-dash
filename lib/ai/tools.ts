// Tool definitions for the Overseer chat — Anthropic tool use schemas + server-side executors.
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

export const OVERSEER_TOOLS: Anthropic.Tool[] = [
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
    name: "dispatch_worker",
    description: "Manually fire a specific worker now. Returns immediately; result will appear in worker history shortly.",
    input_schema: {
      type: "object" as const,
      properties: {
        worker_id: { type: "string", description: "UUID or name substring of the worker to dispatch" },
        instructions: { type: "string", description: "Optional one-shot override instructions for this run" },
      },
      required: ["worker_id"],
    },
  },
  {
    name: "create_worker",
    description: "Define a new specialized worker. The worker will run on its schedule (or on-demand if no schedule given).",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        description: { type: "string", description: "What this worker does, one sentence." },
        system_prompt: { type: "string", description: "Full system prompt that defines the worker's job, style, and constraints." },
        schedule: { type: "string", description: "Optional cron string (e.g. '0 7 * * *' for daily 7am). Omit for on-demand only." },
        allowed_tools: { type: "array", items: { type: "string" }, description: "Tool names this worker is allowed to use." },
      },
      required: ["name", "system_prompt"],
    },
  },
  {
    name: "list_workers",
    description: "List all active workers and their recent run summaries.",
    input_schema: { type: "object", properties: {} },
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

export const ALL_JARVIS_TOOLS: Anthropic.Tool[] = [...OVERSEER_TOOLS, ...JARVIS_EXTRA_TOOLS];

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

// Tools workers get (everything Jarvis has + code execution).
// Code execution doesn't go into Jarvis chat because runs can take 30+s
// and that would block voice/chat UX. Workers are async — they can wait.
export const WORKER_TOOLS: Anthropic.Tool[] = [...ALL_JARVIS_TOOLS, CODE_EXECUTION_TOOL];

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

      // ── Jarvis worker tools ────────────────────────────
      case "dispatch_worker": {
        const idOrName = String(input.worker_id ?? "");
        const { data: workers } = await supabase
          .from("jarvis_workers").select("id, name").eq("user_id", userId).eq("is_active", true);
        const worker =
          (workers ?? []).find((w) => w.id === idOrName) ??
          (workers ?? []).find((w) => w.name.toLowerCase().includes(idOrName.toLowerCase()));
        if (!worker) return { ok: false, error: `No worker matching "${idOrName}"` };
        // Schedule it for immediate next run by setting next_run_at to now()
        await supabase.from("jarvis_workers").update({ next_run_at: new Date().toISOString() }).eq("id", worker.id);
        return { ok: true, message: `Dispatched "${worker.name}". Result will appear shortly.` };
      }

      case "create_worker": {
        const name          = String(input.name ?? "").trim();
        const description   = (input.description as string | undefined) ?? null;
        const system_prompt = String(input.system_prompt ?? "").trim();
        const schedule      = (input.schedule as string | undefined) ?? null;
        const allowed_tools = Array.isArray(input.allowed_tools) ? input.allowed_tools as string[] : [];
        if (!name || !system_prompt) return { ok: false, error: "Name and system_prompt required" };
        const { data, error } = await supabase.from("jarvis_workers").insert({
          user_id: userId,
          name, description, system_prompt, schedule, allowed_tools,
          next_run_at: schedule ? new Date(Date.now() + 60_000).toISOString() : null,
        }).select("id, name").single();
        if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
        return { ok: true, message: `Created worker "${data.name}"${schedule ? ` (cron: ${schedule})` : " (on-demand)"}` };
      }

      case "list_workers": {
        const { data: workers } = await supabase
          .from("jarvis_workers")
          .select("name, description, schedule, last_run_at, is_active")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        if (!workers || workers.length === 0) return { ok: true, message: "No workers deployed." };
        return {
          ok: true,
          message: workers.map((w) =>
            `• ${w.name}${w.schedule ? ` (${w.schedule})` : " (on-demand)"}${w.last_run_at ? ` — last ran ${new Date(w.last_run_at).toLocaleString()}` : ""}`
          ).join("\n"),
        };
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
