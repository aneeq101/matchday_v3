-- ============================================================
-- Patch: fix likes/tournament triggers + inbox unread + read marking
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Triggers must be SECURITY DEFINER so they can UPDATE posts/tournaments
--    regardless of who fired the trigger.  Without this, the posts_update RLS
--    policy (auth.uid() = author_id) silently blocks the likes_count update.

CREATE OR REPLACE FUNCTION fn_post_likes_count()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSE
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION fn_tournament_participants()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tournaments SET participants_count = participants_count + 1 WHERE id = NEW.tournament_id;
  ELSE
    UPDATE tournaments SET participants_count = GREATEST(0, participants_count - 1) WHERE id = OLD.tournament_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION fn_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE conversations
    SET last_message_text = NEW.text, last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- 2. Update get_my_conversations to include unread flag.
--    A conversation is unread if its last_message_at is after the user's last_read_at.

CREATE OR REPLACE FUNCTION get_my_conversations()
RETURNS TABLE(
  id                uuid,
  other_user_id     uuid,
  last_message_text text,
  last_message_at   timestamptz,
  unread            boolean
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    cp2.user_id                                                                     AS other_user_id,
    c.last_message_text,
    c.last_message_at,
    c.last_message_at > COALESCE(cp1.last_read_at, '1970-01-01'::timestamptz)       AS unread
  FROM   conversations c
  JOIN   conversation_participants cp1
         ON c.id = cp1.conversation_id AND cp1.user_id = auth.uid()
  JOIN   conversation_participants cp2
         ON c.id = cp2.conversation_id AND cp2.user_id <> auth.uid()
  ORDER  BY c.last_message_at DESC;
$$;

-- 3. Function to mark a conversation as read (updates last_read_at for the caller).
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  UPDATE conversation_participants
    SET last_read_at = now()
  WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid();
$$;
