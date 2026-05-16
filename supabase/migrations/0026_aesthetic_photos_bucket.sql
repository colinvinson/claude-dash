-- Storage bucket for aesthetic check-in photos.
--
-- Bucket is PRIVATE. Object paths are namespaced by user_id so RLS can
-- restrict access per-user without exposing other users' photos.
--
-- Object path convention: `${user_id}/${YYYY-MM-DD}_${angle}_${rand}.${ext}`
-- e.g.  `abc-123/2026-05-16_front_x7k.jpg`

-- Create the bucket if it doesn't exist (idempotent via DO block).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'aesthetic-photos') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('aesthetic-photos', 'aesthetic-photos', false, 10485760,
            ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']);
  END IF;
END $$;

-- RLS policies — owner can read/write their own object path prefix.
-- storage.objects has bucket_id + name (path). We split path on '/' and
-- compare the first segment to auth.uid().

DROP POLICY IF EXISTS "aesthetic_photos_read_own"   ON storage.objects;
DROP POLICY IF EXISTS "aesthetic_photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "aesthetic_photos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "aesthetic_photos_delete_own" ON storage.objects;

CREATE POLICY "aesthetic_photos_read_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'aesthetic-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "aesthetic_photos_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'aesthetic-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "aesthetic_photos_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'aesthetic-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "aesthetic_photos_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'aesthetic-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
