import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { code } = await req.json() as { code: string };

  const expected = process.env.APP_PASSCODE;
  const email    = process.env.AUTH_EMAIL;
  const password = process.env.AUTH_PASSWORD;

  if (!expected || !email || !password) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  if (String(code).trim() !== expected) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  // Code matches — sign the user in by exchanging the configured creds for a real
  // Supabase session. createClient handles setting auth cookies on the response.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
