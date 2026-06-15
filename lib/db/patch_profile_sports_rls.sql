-- Fix profile_sports RLS: add explicit WITH CHECK for write operations
-- so authenticated users can insert/update/delete their own sports.
-- Run in Supabase SQL Editor.

DROP POLICY IF EXISTS "profile_sports_select" ON profile_sports;
DROP POLICY IF EXISTS "profile_sports_all"    ON profile_sports;

-- Public reads
CREATE POLICY "profile_sports_select"
  ON profile_sports FOR SELECT
  USING (true);

-- Own-row writes (authenticated users only)
CREATE POLICY "profile_sports_insert"
  ON profile_sports FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "profile_sports_update"
  ON profile_sports FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "profile_sports_delete"
  ON profile_sports FOR DELETE
  USING (profile_id = auth.uid());
