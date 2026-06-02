-- ============================================================
-- Patch: delete duplicate conversations between the same pair
-- of users, keeping the most recent one per pair.
-- Run in Supabase SQL Editor.
-- ============================================================

DELETE FROM conversations
WHERE id IN (
  SELECT conversation_id
  FROM (
    SELECT
      cp1.conversation_id,
      ROW_NUMBER() OVER (
        PARTITION BY LEAST(cp1.user_id::text, cp2.user_id::text),
                     GREATEST(cp1.user_id::text, cp2.user_id::text)
        ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
      ) AS rn
    FROM   conversation_participants cp1
    JOIN   conversation_participants cp2
           ON cp1.conversation_id = cp2.conversation_id
           AND cp1.user_id <> cp2.user_id
           AND cp1.user_id < cp2.user_id   -- avoid double-counting each pair
    JOIN   conversations c ON c.id = cp1.conversation_id
  ) ranked
  WHERE rn > 1
);
