-- ============================================================
-- Patch: comments, post media, sport details, avatar fix, ranking
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Post comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  author_name         text NOT NULL DEFAULT 'Player',
  author_initials     text NOT NULL DEFAULT 'P',
  author_avatar_color text          DEFAULT '#16a34a',
  author_avatar_url   text,
  text                text NOT NULL,
  created_at          timestamptz   DEFAULT now()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select" ON post_comments;
DROP POLICY IF EXISTS "comments_insert" ON post_comments;
DROP POLICY IF EXISTS "comments_delete" ON post_comments;
CREATE POLICY "comments_select" ON post_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON post_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments_delete" ON post_comments FOR DELETE USING (auth.uid() = author_id);

-- Trigger: maintain comments_count (SECURITY DEFINER so it can update posts)
CREATE OR REPLACE FUNCTION fn_post_comments_count()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSE
    UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_comments_count ON post_comments;
CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION fn_post_comments_count();

-- 2. Add media columns to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_url  text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_type text; -- 'image' | 'video'

-- 3. Add sport-specific details to profile_sports
ALTER TABLE profile_sports ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';

-- 4. Fix avatar_url for existing auth users whose profiles were created before the column existed
UPDATE profiles p
SET    avatar_url = u.raw_user_meta_data->>'avatar_url'
FROM   auth.users u
WHERE  p.id = u.id
  AND  p.avatar_url IS NULL
  AND  u.raw_user_meta_data->>'avatar_url' IS NOT NULL;

-- 5. Storage bucket for post media (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "post_media_read"   ON storage.objects;
DROP POLICY IF EXISTS "post_media_upload" ON storage.objects;
DROP POLICY IF EXISTS "post_media_delete" ON storage.objects;

CREATE POLICY "post_media_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-media');

CREATE POLICY "post_media_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-media' AND auth.role() = 'authenticated');

CREATE POLICY "post_media_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Ranking function: returns the current user's stats + their rank in their area
CREATE OR REPLACE FUNCTION get_my_ranking()
RETURNS TABLE(
  matches    int,
  wins       int,
  win_rate   numeric,
  area_rank  int,
  area_total int,
  area       text
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  v_wins    int;
  v_matches int;
  v_area    text;
BEGIN
  SELECT
    COALESCE((stats->>'wins')::int,    0),
    COALESCE((stats->>'matches')::int, 0),
    COALESCE(profiles.area, '')
  INTO v_wins, v_matches, v_area
  FROM profiles WHERE id = me;

  RETURN QUERY
  SELECT
    v_matches,
    v_wins,
    CASE WHEN v_matches > 0
         THEN ROUND(v_wins::numeric / v_matches * 100, 1)
         ELSE 0::numeric END,
    (SELECT COUNT(*)::int + 1 FROM profiles
     WHERE area = v_area AND NOT is_demo
       AND COALESCE((stats->>'wins')::int, 0) > v_wins),
    (SELECT COUNT(*)::int FROM profiles
     WHERE area = v_area AND NOT is_demo),
    v_area;
END;
$$;
