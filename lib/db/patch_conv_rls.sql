-- ============================================================
-- Patch: fix conversation_participants RLS so users can see
-- all participants of conversations they belong to.
-- Run in Supabase SQL Editor.
-- ============================================================

-- The original policy only allowed reading rows WHERE user_id = auth.uid().
-- That blocked the "find existing conversation" lookup which needs to read
-- the OTHER user's participant row to confirm a shared conversation exists.

DROP POLICY IF EXISTS "conv_part_select" ON conversation_participants;

CREATE POLICY "conv_part_select" ON conversation_participants
FOR SELECT USING (
  -- Your own row, OR any row in a conversation you're part of
  user_id = auth.uid()
  OR conversation_id IN (
    SELECT cp.conversation_id
    FROM conversation_participants cp
    WHERE cp.user_id = auth.uid()
  )
);
