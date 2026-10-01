-- ============================================================
-- MatchDay — In-app popups for challenges (new, accepted, declined, called off, result)
--
--  • challenges.opponent_seen_at: when the challenged player (or team
--    captain) saw the popup. A challenge pops up only while this is
--    empty, so it never repeats — on any device.
--  • mark_challenge_seen(id) RPC ("Decide later"), and respond_challenge
--    now also marks the challenge as seen.
--  • challenges and notifications added to Supabase Realtime so the app
--    is told the moment a challenge arrives or is accepted / declined /
--    called off / given a result (row security still applies: people
--    only receive their own rows). Update popups are driven by the
--    existing 'challenge_update' notifications; closing one marks it read.
--  • Existing challenges are marked seen, except pending ones from the
--    last 7 days (those will pop up once).
--
-- Run once in Supabase SQL Editor. Safe to re-run. All-or-nothing.
-- ============================================================

BEGIN;

ALTER TABLE challenges ADD COLUMN IF NOT EXISTS opponent_seen_at timestamptz;

-- First run only (column was just added → every row is still NULL)
UPDATE challenges SET opponent_seen_at = now()
WHERE opponent_seen_at IS NULL
  AND NOT (status = 'pending' AND created_at > now() - interval '7 days')
  AND NOT EXISTS (SELECT 1 FROM challenges c2 WHERE c2.opponent_seen_at IS NOT NULL);

CREATE OR REPLACE FUNCTION mark_challenge_seen(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE challenges SET opponent_seen_at = COALESCE(opponent_seen_at, now())
  WHERE id = p_id AND opponent_user_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION mark_challenge_seen(uuid) TO authenticated;

-- Same as before (patch_brackets_challenges.sql) + marks the challenge seen
CREATE OR REPLACE FUNCTION respond_challenge(p_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c challenges%ROWTYPE;
BEGIN
  SELECT * INTO c FROM challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR c.opponent_user_id <> auth.uid() THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;

  UPDATE challenges
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      opponent_seen_at = COALESCE(opponent_seen_at, now()),
      updated_at = now()
  WHERE id = p_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (c.challenger_user_id, 'challenge_update',
          CASE WHEN p_accept THEN '⚔️ Challenge accepted' ELSE 'Challenge declined' END,
          c.opponent_name || CASE WHEN p_accept THEN ' accepted' ELSE ' declined' END
                          || ' your ' || c.sport || ' challenge.',
          jsonb_build_object('challenge_id', p_id));
END;
$$;
GRANT EXECUTE ON FUNCTION respond_challenge(uuid, boolean) TO authenticated;

-- Live updates for challenges and notifications
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['challenges', 'notifications'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
