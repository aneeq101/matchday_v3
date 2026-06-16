-- Add media columns to posts table
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_url  text,
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'video'));

-- ─── Supabase Storage bucket ────────────────────────────────────────────────
-- Run this in the Supabase dashboard → Storage → New bucket:
--   Name: post-media   |   Public: true   |   File size limit: 50 MB
--   Allowed MIME types: image/jpeg, image/png, image/webp, video/mp4, video/quicktime
--
-- Then add these storage policies (dashboard → Storage → post-media → Policies):

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  52428800,  -- 50 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read files
DROP POLICY IF EXISTS "post_media_select" ON storage.objects;
CREATE POLICY "post_media_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-media');

-- Authenticated users can upload to their own folder (userId/filename)
DROP POLICY IF EXISTS "post_media_insert" ON storage.objects;
CREATE POLICY "post_media_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'post-media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own uploads
DROP POLICY IF EXISTS "post_media_delete" ON storage.objects;
CREATE POLICY "post_media_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'post-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
