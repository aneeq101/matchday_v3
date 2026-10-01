-- ============================================================
-- MatchDay — Rating requests ("vouch for my game")
--
--  A player asks people they've played with to rate their game in a
--  sport (or a captain asks for ratings for their team). The asked
--  person gets a notification (and phone push) that opens the rating
--  sheet. The rating they give is a normal rating, so it counts toward
--  badges under the usual rules (≥3 different people at that level,
--  at least half of all raters, last 12 months).
--
--  • rating_requests table (no client writes; RPCs only)
--  • request_ratings(): checks you're asking for yourself / a team you
--    captain, skips people who can't or shouldn't be asked (yourself,
--    demo players, your own team members for team requests, anyone with
--    a pending request or asked in the last 30 days for that sport).
--    Max 10 people per request, 20 per day.
--  • rating_request_suggestions(): people you've actually played with
--    first (challenges, tournament matches, teammates, pickup matches),
--    then people you follow / who follow you.
--  • decline_rating_request(): "Not now" (the asker isn't notified).
--  • A rating from the asked person automatically completes the request.
--
-- Run once in Supabase SQL Editor (after patch_ratings.sql). Safe to re-run.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS rating_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_kind      text NOT NULL CHECK (subject_kind IN ('player', 'team')),
  subject_id        uuid NOT NULL,                   -- the player (= requester) or the team
  subject_name      text NOT NULL DEFAULT '',
  sport             text NOT NULL,
  rater_user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note              text NOT NULL DEFAULT '' CHECK (char_length(note) <= 200),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'declined')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  responded_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS rating_requests_one_pending
  ON rating_requests (subject_id, rater_user_id, sport) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS rating_requests_rater_idx     ON rating_requests (rater_user_id, status);
CREATE INDEX IF NOT EXISTS rating_requests_requester_idx ON rating_requests (requester_user_id, created_at);

ALTER TABLE rating_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rating_requests_select" ON rating_requests;
CREATE POLICY "rating_requests_select" ON rating_requests FOR SELECT
  USING (auth.uid() = requester_user_id OR auth.uid() = rater_user_id);
-- No write policies: RPCs below + the ratings trigger.

-- Delete a team → its requests go too
CREATE OR REPLACE FUNCTION fn_rating_requests_team_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM rating_requests WHERE subject_kind = 'team' AND subject_id = OLD.id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_rating_requests_team_deleted ON teams;
CREATE TRIGGER trg_rating_requests_team_deleted
  AFTER DELETE ON teams FOR EACH ROW EXECUTE FUNCTION fn_rating_requests_team_deleted();

-- ── Send requests ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION request_ratings(
  p_subject_kind text, p_subject_id uuid, p_sport text, p_rater_ids uuid[], p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me        uuid := auth.uid();
  v_sport   text := p_sport;
  v_name    text;
  my_name   text;
  today_cnt int;
  room      int;
  sent      int := 0;
  skipped   int := 0;
  r         uuid;
  new_id    uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF char_length(COALESCE(p_note, '')) > 200 THEN RAISE EXCEPTION 'NOTE_TOO_LONG'; END IF;
  IF COALESCE(array_length(p_rater_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'NO_RATERS'; END IF;
  IF array_length(p_rater_ids, 1) > 10 THEN RAISE EXCEPTION 'TOO_MANY'; END IF;

  SELECT name INTO my_name FROM profiles WHERE id = me;

  IF p_subject_kind = 'team' THEN
    SELECT name, sport INTO v_name, v_sport FROM teams WHERE id = p_subject_id AND owner_id = me;
    IF v_name IS NULL THEN RAISE EXCEPTION 'NOT_CAPTAIN'; END IF;
  ELSIF p_subject_kind = 'player' THEN
    IF p_subject_id <> me THEN RAISE EXCEPTION 'NOT_YOU'; END IF;
    v_name := my_name;
  ELSE
    RAISE EXCEPTION 'INVALID_SUBJECT';
  END IF;

  IF v_sport NOT IN ('Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball', 'Hockey') THEN
    RAISE EXCEPTION 'INVALID_SPORT';
  END IF;

  SELECT count(*) INTO today_cnt FROM rating_requests
  WHERE requester_user_id = me AND created_at > now() - interval '24 hours';
  room := 20 - today_cnt;
  IF room <= 0 THEN RAISE EXCEPTION 'DAILY_LIMIT'; END IF;

  FOREACH r IN ARRAY p_rater_ids LOOP
    IF sent >= room
       OR r = me
       OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = r AND NOT COALESCE(is_demo, false))
       OR (p_subject_kind = 'team' AND EXISTS (SELECT 1 FROM team_members WHERE team_id = p_subject_id AND user_id = r))
       OR EXISTS (SELECT 1 FROM rating_requests q
                  WHERE q.subject_id = p_subject_id AND q.rater_user_id = r AND q.sport = v_sport
                    AND (q.status = 'pending' OR q.created_at > now() - interval '30 days'))
    THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO rating_requests (requester_user_id, subject_kind, subject_id, subject_name, sport, rater_user_id, note)
    VALUES (me, p_subject_kind, p_subject_id, v_name, v_sport, r, btrim(COALESCE(p_note, '')))
    RETURNING id INTO new_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (r, 'rating_request',
            '⭐ Rate ' || v_name || '''s ' || v_sport || CASE WHEN p_subject_kind = 'team' THEN ' team?' ELSE ' game?' END,
            COALESCE(my_name, 'A player') || ' asked you to rate '
              || CASE WHEN p_subject_kind = 'team' THEN v_name ELSE 'them' END
              || '. Takes a minute and helps them earn badges.'
              || CASE WHEN btrim(COALESCE(p_note, '')) <> '' THEN ' “' || btrim(p_note) || '”' ELSE '' END,
            jsonb_build_object('rating_request_id', new_id, 'rate_kind', p_subject_kind,
                               'rate_id', p_subject_id, 'rate_name', v_name, 'sport', v_sport));
    sent := sent + 1;
  END LOOP;

  RETURN jsonb_build_object('sent', sent, 'skipped', skipped);
END;
$$;
GRANT EXECUTE ON FUNCTION request_ratings(text, uuid, text, uuid[], text) TO authenticated;

-- ── "Not now" ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION decline_rating_request(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE rating_requests SET status = 'declined', responded_at = now()
  WHERE id = p_id AND rater_user_id = auth.uid() AND status = 'pending';
END;
$$;
GRANT EXECUTE ON FUNCTION decline_rating_request(uuid) TO authenticated;

-- ── A rating completes the matching request ─────────────────
CREATE OR REPLACE FUNCTION fn_ratings_complete_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE rating_requests SET status = 'done', responded_at = now()
  WHERE rater_user_id = NEW.rater_user_id
    AND subject_id = COALESCE(NEW.target_player, NEW.target_team)
    AND sport = NEW.sport
    AND status = 'pending';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_ratings_complete_requests ON ratings;
CREATE TRIGGER trg_ratings_complete_requests
  AFTER INSERT OR UPDATE ON ratings FOR EACH ROW EXECUTE FUNCTION fn_ratings_complete_requests();

-- ── Who to ask ──────────────────────────────────────────────
-- reason: 'played' (challenge / tournament match / pickup match), 'teammate',
-- 'follows' (follow either way). Played-with people first.
CREATE OR REPLACE FUNCTION rating_request_suggestions(p_subject_kind text, p_subject_id uuid, p_sport text)
RETURNS TABLE (id uuid, name text, initials text, avatar_color text, reason text, already_rated boolean, requested boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  ok AS (   -- caller must be the player, or the team's captain
    SELECT 1 WHERE (p_subject_kind = 'player' AND p_subject_id = (SELECT uid FROM me))
               OR (p_subject_kind = 'team' AND EXISTS (SELECT 1 FROM teams WHERE teams.id = p_subject_id AND owner_id = (SELECT uid FROM me)))
  ),
  sides AS (   -- ids that stand for "us" in challenges / tournament matches
    SELECT p_subject_id AS sid
    UNION SELECT tm.team_id FROM team_members tm, me WHERE p_subject_kind = 'player' AND tm.user_id = me.uid
  ),
  opp AS (     -- the other side of finished games
    SELECT CASE WHEN c.challenger_id IN (SELECT sid FROM sides) THEN c.opponent_user_id ELSE c.challenger_user_id END AS uid
    FROM challenges c
    WHERE c.status = 'completed' AND (c.challenger_id IN (SELECT sid FROM sides) OR c.opponent_id IN (SELECT sid FROM sides))
    UNION
    SELECT COALESCE(t.owner_id, x.other) FROM (
      SELECT CASE WHEN m.a_id IN (SELECT sid FROM sides) THEN m.b_id ELSE m.a_id END AS other
      FROM tournament_matches m
      WHERE m.status = 'done' AND (m.a_id IN (SELECT sid FROM sides) OR m.b_id IN (SELECT sid FROM sides))
    ) x LEFT JOIN teams t ON t.id = x.other
    UNION
    SELECT y.player_id FROM match_players x2 JOIN match_players y ON y.match_id = x2.match_id, me
    WHERE p_subject_kind = 'player' AND x2.player_id = me.uid
  ),
  cand AS (
    SELECT uid, 'played' AS reason, 1 AS pri FROM opp
    UNION ALL
    SELECT y.user_id, 'teammate', 2 FROM team_members x JOIN teams t ON t.id = x.team_id
      JOIN team_members y ON y.team_id = x.team_id, me
    WHERE p_subject_kind = 'player' AND x.user_id = me.uid AND t.sport = p_sport
    UNION ALL
    SELECT f.follower_id, 'follows', 3 FROM follows f, me WHERE f.following_id = me.uid
    UNION ALL
    SELECT f.following_id, 'follows', 3 FROM follows f, me WHERE f.follower_id = me.uid
  ),
  best AS (
    SELECT DISTINCT ON (c.uid) c.uid, c.reason, c.pri FROM cand c, me
    WHERE c.uid IS NOT NULL AND c.uid <> me.uid
    ORDER BY c.uid, c.pri
  )
  SELECT p.id, p.name, COALESCE(p.initials, upper(left(p.name, 2))), COALESCE(p.avatar_color, '#16a34a'), b.reason,
         EXISTS (SELECT 1 FROM ratings r WHERE r.rater_user_id = p.id
                   AND COALESCE(r.target_player, r.target_team) = p_subject_id AND r.sport = p_sport),
         EXISTS (SELECT 1 FROM rating_requests q WHERE q.rater_user_id = p.id AND q.subject_id = p_subject_id
                   AND q.sport = p_sport AND (q.status = 'pending' OR q.created_at > now() - interval '30 days'))
  FROM best b JOIN profiles p ON p.id = b.uid
  WHERE EXISTS (SELECT 1 FROM ok)
    AND NOT COALESCE(p.is_demo, false)
    AND NOT (p_subject_kind = 'team' AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = p_subject_id AND tm.user_id = p.id))
  ORDER BY b.pri, p.name
  LIMIT 100
$$;
GRANT EXECUTE ON FUNCTION rating_request_suggestions(text, uuid, text) TO authenticated;

COMMIT;
