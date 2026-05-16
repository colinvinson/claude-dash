// Aesthetic photo upload to Supabase Storage. The bucket is private; we
// store paths like `${user_id}/${date}_${angle}_${rand}.jpg`. The
// aesthetic_logs row gets the bucket path saved as photo_url so we can
// regenerate signed URLs on read.

import { createClient } from "@/lib/supabase/client";

export async function uploadAestheticPhoto(opts: {
  file:  File;
  angle: string;
}): Promise<{ path: string } | { error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const date = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 8);
  const ext  = opts.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeAngle = opts.angle.replace(/[^a-z0-9]/gi, "");
  const path = `${user.id}/${date}_${safeAngle}_${rand}.${ext}`;

  const { error } = await supabase.storage
    .from("aesthetic-photos")
    .upload(path, opts.file, { upsert: false, contentType: opts.file.type });

  if (error) return { error: error.message };
  return { path };
}

// Read-side: produce a short-lived signed URL for a stored path. Photos
// are private so the bucket can't be queried directly; signed URLs are
// the only access path.
export async function getAestheticPhotoUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  if (!path) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("aesthetic-photos")
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
