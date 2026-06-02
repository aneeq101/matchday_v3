-- ============================================================
-- Patch: replace self-referential RLS with SECURITY DEFINER
-- functions for conversation lookups.
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Revert the problematic self-referential conv_part_select policy
--    back to the simple form (only read your own rows).
--    Server-side functions handle the cross-participant lookups.
DROP POLICY IF EXISTS "conv_part_select" ON conversation_participants;
CREATE POLICY "conv_part_select" ON conversation_participants
  FOR SELECT USING (user_id = auth.uid());

-- 2. get_or_create_conversation(other_user_id)
--    Finds an existing 1-on-1 conversation between the caller and
--    another user, or creates one. Returns the conversation UUID.
--    SECURITY DEFINER bypasses RLS so it can join across participants.
CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me        uuid := auth.uid();
  conv_id   uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look for an existing shared conversation
  SELECT cp1.conversation_id INTO conv_id
  FROM   conversation_participants cp1
  JOIN   conversation_participants cp2
         ON cp1.conversation_id = cp2.conversation_id
  WHERE  cp1.user_id = me
    AND  cp2.user_id = other_user_id
  LIMIT  1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- Create a new conversation
  conv_id := gen_random_uuid();
  INSERT INTO conversations (id) VALUES (conv_id);
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES
    (conv_id, me),
    (conv_id, other_user_id);

  RETURN conv_id;
END;
$$;

-- 3. get_my_conversations()
--    Returns one row per conversation the caller is in, including
--    the other participant's user_id and the last message info.
CREATE OR REPLACE FUNCTION get_my_conversations()
RETURNS TABLE(
  id                uuid,
  other_user_id     uuid,
  last_message_text text,
  last_message_at   timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    cp2.user_id          AS other_user_id,
    c.last_message_text,
    c.last_message_at
  FROM   conversations c
  JOIN   conversation_participants cp1
         ON c.id = cp1.conversation_id AND cp1.user_id = auth.uid()
  JOIN   conversation_participants cp2
         ON c.id = cp2.conversation_id AND cp2.user_id <> auth.uid()
  ORDER  BY c.last_message_at DESC;
$$;
