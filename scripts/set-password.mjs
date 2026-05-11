// One-time script to set a Supabase user's password using the service-role key.
// Bypasses the email rate limit. Run from project root:
//
//   node scripts/set-password.mjs <email> <new-password>
//
// e.g.:
//   node scripts/set-password.mjs colinvinson@icloud.com "MyStrongPassword123!"

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load .env.local
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx), l.slice(idx + 1).trim()];
    })
);

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/set-password.mjs <email> <new-password>");
  process.exit(1);
}

const url     = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, service);

// 1. Find user by email
const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listErr) {
  console.error("Failed to list users:", listErr.message);
  process.exit(1);
}

const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}

// 2. Update password
const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { password });
if (updErr) {
  console.error("Failed to update password:", updErr.message);
  process.exit(1);
}

console.log(`✓ Password updated for ${email}`);
console.log(`  User ID: ${user.id}`);
console.log(`  Now paste this password into Vercel as AUTH_PASSWORD and into your local .env.local.`);
