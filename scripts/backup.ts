#!/usr/bin/env tsx
// Weekly Supabase dump. Pulls every row of every table Sir's data lives in,
// writes a timestamped JSON file under ~/Documents/rowan-backups/.
// Runs via launchd weekly (see scripts/com.colinvinson.rowan-backup.plist).
//
// One file per run, gzip-compressed, named: rowan-backup-YYYY-MM-DD.json.gz
// Old backups beyond 26 weeks (6 months) auto-pruned to keep disk usage bounded.

import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import { createGzip } from "zlib";
import { createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import path from "path";
import os from "os";

import "dotenv/config";
import dotenv from "dotenv";
import { existsSync } from "fs";
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[backup] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Every user-data table that's currently active. Add new tables here when
// adding tracking features — the future-feature rule in AGENTS.md mentions this.
const TABLES = [
  "profiles",
  "goals",
  "goal_streaks",
  "goal_templates",
  "long_term_goals",
  "supplement_stack",
  "supplement_logs",
  "medication_logs",
  "gym_locations",
  "exercises",
  "workout_sets",
  "health_logs",
  "water_logs",
  "faith_logs",
  "mood_logs",
  "weight_logs",
  "alcohol_logs",
  "meditation_logs",
  "journal_entries",
  "daily_context",
  "protein_logs",
  "morning_briefings",
  "weekly_reviews",
  "jarvis_facts",
  "jarvis_insights",
  "jarvis_messages",
  "jarvis_artifacts",
  "jarvis_cc_dispatches",
];

const RETENTION_WEEKS = 26;

async function fetchAll(table: string) {
  // Page in 1000-row chunks. Supabase caps single-query responses.
  const PAGE = 1000;
  const out: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.from(table).select("*").range(offset, offset + PAGE - 1);
    if (error) {
      console.warn(`[backup] ${table}: ${error.message}`);
      return out;
    }
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

async function pruneOldBackups(dir: string) {
  try {
    const files = await fs.readdir(dir);
    const stamped = files
      .filter((f) => f.startsWith("rowan-backup-") && f.endsWith(".json.gz"))
      .map((f) => ({ f, mtime: 0 }));
    for (const entry of stamped) {
      const stat = await fs.stat(path.join(dir, entry.f));
      entry.mtime = stat.mtimeMs;
    }
    stamped.sort((a, b) => b.mtime - a.mtime);
    const toDelete = stamped.slice(RETENTION_WEEKS);
    for (const old of toDelete) {
      await fs.unlink(path.join(dir, old.f));
      console.log(`[backup] pruned ${old.f}`);
    }
  } catch (err) {
    console.warn("[backup] prune error:", (err as Error).message);
  }
}

async function main() {
  const dir = path.join(os.homedir(), "Documents", "rowan-backups");
  await fs.mkdir(dir, { recursive: true });

  const dump: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    supabase_url: SUPABASE_URL,
    tables: {},
  };

  let totalRows = 0;
  for (const t of TABLES) {
    const rows = await fetchAll(t);
    (dump.tables as Record<string, unknown[]>)[t] = rows;
    totalRows += rows.length;
    console.log(`[backup] ${t}: ${rows.length}`);
  }

  const date = new Date().toISOString().slice(0, 10);
  const filePath = path.join(dir, `rowan-backup-${date}.json.gz`);
  const json = JSON.stringify(dump, null, 2);

  await pipeline(Readable.from(json), createGzip(), createWriteStream(filePath));
  const stat = await fs.stat(filePath);
  console.log(`[backup] wrote ${filePath} (${Math.round(stat.size / 1024)}KB, ${totalRows} rows)`);

  await pruneOldBackups(dir);
}

main().catch((err) => {
  console.error("[backup] fatal:", err);
  process.exit(1);
});
