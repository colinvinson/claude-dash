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
];

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

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tool execution failed" };
  }
}
