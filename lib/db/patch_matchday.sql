-- ============================================================
-- MatchDay — "Ready for match day?" + players record scores
--
--  1. Real event dates: tournaments.starts_on / matches.starts_on (date),
--     filled from the existing date text ("Sat, Oct 12, 2026",
--     "Sat, Oct 12, 2026 at 5:00 PM") and kept in sync by triggers.
--
--  2. READY FOR MATCH DAY: the moment an event has what it needs to go
--     ahead, everyone in it gets an 'event_ready' notification + push:
--       • tournaments / leagues → minimum entrants reached
--       • pickup "match" events → full line-up
--       • Organize Match games (matches table) → full line-up
--     "Everyone" = signed-up players, members of signed-up teams, the
--     organiser. Announced once per event (ready_at).
--     The in-app popup is a REMINDER: my_pending_ready() lists every ready
--     event the player hasn't confirmed yet, and the app keeps showing it
--     until they tap "I'm ready" (ack_ready). "Remind me later"
--     (snooze_ready) hides it for 12 hours, or until match day if that's
--     sooner. Events that were already full before this patch were marked
--     ready silently.
--
--  3. Players record scores:
--       • tournament / league games: the two sides (player or captain)
--         can record their own game; once the event date has passed any
--         entrant can; the organiser always can. Once the date has passed
--         an entrant can also start the draw if the organiser hasn't.
--       • pickup "match" events and Organize Match games: any player in
--         it (or the organiser) records the final score and who won
--         (my side / the other side / draw) once the date has passed — or,
--         with no date set, once the line-up is full.
--     EVERYONE in the event (except whoever entered it) gets a
--     'match_result' notification: in-app popup + phone push.
--
-- Run in Supabase SQL Editor. Safe to re-run (also on top of an earlier
-- version of this file). All-or-nothing.
-- ============================================================

BEGIN;

-- ── 1. Dates & result columns ───────────────────────────────
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS starts_on      date;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ready_at       timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS result_score   text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS result_note    text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS result_by      uuid;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS result_at      timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS result_outcome text;   -- 'won' | 'lost' | 'draw' (for result_by's side)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS result_summary text;   -- "Aneeq won", "Draw", …

ALTER TABLE matches ADD COLUMN IF NOT EXISTS starts_on      date;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ready_at       timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_score   text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_note    text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_by      uuid;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_at      timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_outcome text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_summary text;

-- "Sat, Oct 12, 2026" / "Sat, Oct 12, 2026 at 5:00 PM" → 2026-10-12; anything else → NULL
CREATE OR REPLACE FUNCTION fn_parse_event_date(p text)
RETURNS date LANGUAGE plpgsql STABLE AS $$
DECLARE s text;
BEGIN
  IF p IS NULL OR p ~* '^\s*(tbd|tba)?\s*$' THEN RETURN NULL; END IF;
  s := regexp_replace(p, '\s+at\s+.*$', '');
  s := regexp_replace(s, '^[A-Za-z]{3,9},\s*', '');
  RETURN to_date(s, 'Mon DD, YYYY');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION fn_tournaments_starts_on()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.starts_on IS NULL OR (TG_OP = 'UPDATE' AND NEW.date_text IS DISTINCT FROM OLD.date_text
                                AND NEW.starts_on IS NOT DISTINCT FROM OLD.starts_on) THEN
    NEW.starts_on := fn_parse_event_date(NEW.date_text);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tournaments_starts_on ON tournaments;
CREATE TRIGGER trg_tournaments_starts_on
  BEFORE INSERT OR UPDATE OF date_text, starts_on ON tournaments
  FOR EACH ROW EXECUTE FUNCTION fn_tournaments_starts_on();

CREATE OR REPLACE FUNCTION fn_matches_starts_on()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.starts_on IS NULL OR (TG_OP = 'UPDATE' AND NEW.match_date IS DISTINCT FROM OLD.match_date
                                AND NEW.starts_on IS NOT DISTINCT FROM OLD.starts_on) THEN
    NEW.starts_on := fn_parse_event_date(NEW.match_date);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_matches_starts_on ON matches;
CREATE TRIGGER trg_matches_starts_on
  BEFORE INSERT OR UPDATE OF match_date, starts_on ON matches
  FOR EACH ROW EXECUTE FUNCTION fn_matches_starts_on();

UPDATE tournaments SET starts_on = fn_parse_event_date(date_text) WHERE starts_on IS NULL;
UPDATE matches     SET starts_on = fn_parse_event_date(match_date) WHERE starts_on IS NULL;

-- ── 2. Who's in an event ────────────────────────────────────
-- Signed-up players, members of signed-up teams, the organiser (no demo accounts)
CREATE OR REPLACE FUNCTION fn_event_people(p_tournament_id uuid)
RETURNS TABLE (user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT u.uid FROM (
    SELECT r.user_id AS uid FROM tournament_registrations r WHERE r.tournament_id = p_tournament_id
    UNION
    SELECT tm.user_id FROM tournament_registrations r JOIN team_members tm ON tm.team_id = r.team_id
    WHERE r.tournament_id = p_tournament_id AND r.team_id IS NOT NULL
    UNION
    SELECT t.organiser_id FROM tournaments t WHERE t.id = p_tournament_id
  ) u
  JOIN profiles p ON p.id = u.uid
  WHERE u.uid IS NOT NULL AND NOT COALESCE(p.is_demo, false)
$$;

CREATE OR REPLACE FUNCTION fn_match_people(p_match_id uuid)
RETURNS TABLE (user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT u.uid FROM (
    SELECT mp.player_id AS uid FROM match_players mp WHERE mp.match_id = p_match_id
    UNION
    SELECT m.creator_id FROM matches m WHERE m.id = p_match_id
  ) u
  JOIN profiles p ON p.id = u.uid
  WHERE u.uid IS NOT NULL AND NOT COALESCE(p.is_demo, false)
$$;

-- ── 3. Ready for match day ──────────────────────────────────
CREATE TABLE IF NOT EXISTS event_ready_acks (
  kind      text NOT NULL CHECK (kind IN ('event', 'match')),   -- tournaments row / matches row
  event_id  uuid NOT NULL,
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  acked_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, event_id, user_id)
);
ALTER TABLE event_ready_acks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_ready_acks_select" ON event_ready_acks;
CREATE POLICY "event_ready_acks_select" ON event_ready_acks FOR SELECT USING (true);
-- Writes only through ack_ready()

-- "Remind me later" — private to each player
CREATE TABLE IF NOT EXISTS event_ready_snoozes (
  kind      text NOT NULL CHECK (kind IN ('event', 'match')),
  event_id  uuid NOT NULL,
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  until     timestamptz NOT NULL,
  PRIMARY KEY (kind, event_id, user_id)
);
ALTER TABLE event_ready_snoozes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_ready_snoozes_own" ON event_ready_snoozes;
CREATE POLICY "event_ready_snoozes_own" ON event_ready_snoozes FOR SELECT USING (auth.uid() = user_id);

-- How many entrants an event needs before it can go ahead
CREATE OR REPLACE FUNCTION fn_event_needed(t tournaments)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t.type = 'match' THEN GREATEST(COALESCE(t.max_participants, 2), 2)
              ELSE GREATEST(COALESCE(t.min_participants, 2), 2) END
$$;

-- Events that were already ready before this patch: no announcement
UPDATE tournaments t SET ready_at = now()
WHERE ready_at IS NULL
  AND (SELECT count(*) FROM tournament_registrations r WHERE r.tournament_id = t.id) >= fn_event_needed(t);
UPDATE matches m SET ready_at = now()
WHERE ready_at IS NULL AND COALESCE(m.max_players, 0) > 0 AND m.current_players >= m.max_players;

CREATE OR REPLACE FUNCTION fn_event_ready_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t     tournaments%ROWTYPE;
  n     int;
  when_ text;
BEGIN
  SELECT * INTO t FROM tournaments WHERE id = NEW.tournament_id FOR UPDATE;
  IF NOT FOUND OR t.ready_at IS NOT NULL OR COALESCE(t.status, 'active') <> 'active' THEN RETURN NEW; END IF;
  SELECT count(*) INTO n FROM tournament_registrations WHERE tournament_id = t.id;
  IF n < fn_event_needed(t) THEN RETURN NEW; END IF;

  UPDATE tournaments SET ready_at = now() WHERE id = t.id;
  when_ := COALESCE(NULLIF(t.date_text, ''), 'TBD');

  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.user_id, 'event_ready', '📣 Ready for match day?',
         t.name || CASE WHEN t.type = 'match' THEN ' has a full line-up' ELSE ' has enough entrants to start' END
           || ' · ' || when_ || CASE WHEN COALESCE(t.location, '') <> '' THEN ' · ' || t.location ELSE '' END
           || CASE WHEN p.user_id = t.organiser_id AND t.type <> 'match'
                   THEN '. You can start the draw now.' ELSE '. Tap to confirm you’re in.' END,
         jsonb_build_object('tournament_id', t.id, 'event_kind', 'event')
  FROM fn_event_people(t.id) p;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;   -- never block a sign-up because of an announcement
END;
$$;
DROP TRIGGER IF EXISTS trg_event_ready_check ON tournament_registrations;
CREATE TRIGGER trg_event_ready_check
  AFTER INSERT ON tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION fn_event_ready_check();

CREATE OR REPLACE FUNCTION fn_match_ready_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m matches%ROWTYPE;
  n int;
BEGIN
  SELECT * INTO m FROM matches WHERE id = NEW.match_id FOR UPDATE;
  IF NOT FOUND OR m.ready_at IS NOT NULL OR m.status <> 'upcoming' OR COALESCE(m.max_players, 0) <= 0 THEN RETURN NEW; END IF;
  SELECT count(*) INTO n FROM match_players WHERE match_id = m.id;
  IF n < m.max_players THEN RETURN NEW; END IF;

  UPDATE matches SET ready_at = now() WHERE id = m.id;
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.user_id, 'event_ready', '📣 Ready for match day?',
         m.title || ' has a full line-up · ' || m.match_date
           || CASE WHEN COALESCE(m.location, '') <> '' THEN ' · ' || m.location ELSE '' END
           || '. Tap to confirm you’re in.',
         jsonb_build_object('match_id', m.id, 'event_kind', 'match')
  FROM fn_match_people(m.id) p;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_match_ready_check ON match_players;
CREATE TRIGGER trg_match_ready_check
  AFTER INSERT ON match_players
  FOR EACH ROW EXECUTE FUNCTION fn_match_ready_check();

CREATE OR REPLACE FUNCTION fn_assert_in(p_kind text, p_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_kind = 'event' THEN
    IF NOT EXISTS (SELECT 1 FROM fn_event_people(p_id) WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'NOT_IN_EVENT'; END IF;
  ELSIF p_kind = 'match' THEN
    IF NOT EXISTS (SELECT 1 FROM fn_match_people(p_id) WHERE user_id = auth.uid()) THEN RAISE EXCEPTION 'NOT_IN_EVENT'; END IF;
  ELSE
    RAISE EXCEPTION 'NOT_IN_EVENT';
  END IF;
END;
$$;

-- "I'm ready" — also clears the reminder and marks the alert read
CREATE OR REPLACE FUNCTION ack_ready(p_kind text, p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM fn_assert_in(p_kind, p_id);
  INSERT INTO event_ready_acks (kind, event_id, user_id) VALUES (p_kind, p_id, auth.uid())
  ON CONFLICT DO NOTHING;
  DELETE FROM event_ready_snoozes WHERE kind = p_kind AND event_id = p_id AND user_id = auth.uid();
  UPDATE notifications SET read = true
  WHERE user_id = auth.uid() AND type = 'event_ready' AND read = false
    AND data->>(CASE WHEN p_kind = 'event' THEN 'tournament_id' ELSE 'match_id' END) = p_id::text;
END;
$$;
GRANT EXECUTE ON FUNCTION ack_ready(text, uuid) TO authenticated;

-- "Remind me later": hide for 12 hours, or until match day if that's sooner
CREATE OR REPLACE FUNCTION snooze_ready(p_kind text, p_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d     date;
  until_ts timestamptz := now() + interval '12 hours';
BEGIN
  PERFORM fn_assert_in(p_kind, p_id);
  IF p_kind = 'event' THEN SELECT starts_on INTO d FROM tournaments WHERE id = p_id;
  ELSE SELECT starts_on INTO d FROM matches WHERE id = p_id; END IF;
  IF d IS NOT NULL AND d > current_date AND d::timestamptz < until_ts THEN until_ts := d::timestamptz; END IF;

  INSERT INTO event_ready_snoozes (kind, event_id, user_id, until) VALUES (p_kind, p_id, auth.uid(), until_ts)
  ON CONFLICT (kind, event_id, user_id) DO UPDATE SET until = EXCLUDED.until;
  RETURN until_ts;
END;
$$;
GRANT EXECUTE ON FUNCTION snooze_ready(text, uuid) TO authenticated;

-- Ready events / matches I'm in that I haven't confirmed (and haven't
-- snoozed), not finished, match day not passed. Soonest first.
CREATE OR REPLACE FUNCTION my_pending_ready()
RETURNS TABLE (
  kind text, id uuid, name text, sport text, when_text text, location text,
  lineup text, starts_on date, organiser_can_start boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  ev AS (
    SELECT 'event'::text AS kind, t.id, t.name, t.sport, t.date_text AS when_text, COALESCE(t.location, '') AS location,
           (SELECT count(*) FROM tournament_registrations r WHERE r.tournament_id = t.id)::text || '/' || t.max_participants
             || CASE WHEN t.entrant_type = 'team' THEN ' teams' ELSE ' players' END AS lineup,
           t.starts_on,
           (t.organiser_id = (SELECT uid FROM me) AND t.type <> 'match' AND COALESCE(t.status, 'active') = 'active') AS organiser_can_start
    FROM tournaments t
    WHERE t.ready_at IS NOT NULL
      AND COALESCE(t.status, 'active') <> 'completed'
      AND (t.starts_on IS NULL OR t.starts_on >= current_date)
      AND EXISTS (SELECT 1 FROM fn_event_people(t.id) p WHERE p.user_id = (SELECT uid FROM me))
  ),
  mt AS (
    SELECT 'match'::text, m.id, m.title, m.sport, m.match_date, COALESCE(m.location, ''),
           m.current_players::text || '/' || m.max_players || ' players',
           m.starts_on, false
    FROM matches m
    WHERE m.ready_at IS NOT NULL
      AND m.status = 'upcoming'
      AND (m.starts_on IS NULL OR m.starts_on >= current_date)
      AND EXISTS (SELECT 1 FROM fn_match_people(m.id) p WHERE p.user_id = (SELECT uid FROM me))
  ),
  allr AS (SELECT * FROM ev UNION ALL SELECT * FROM mt)
  SELECT a.* FROM allr a
  WHERE NOT EXISTS (SELECT 1 FROM event_ready_acks k
                    WHERE k.kind = a.kind AND k.event_id = a.id AND k.user_id = (SELECT uid FROM me))
    AND NOT EXISTS (SELECT 1 FROM event_ready_snoozes z
                    WHERE z.kind = a.kind AND z.event_id = a.id AND z.user_id = (SELECT uid FROM me) AND z.until > now())
  ORDER BY a.starts_on NULLS LAST, a.name
  LIMIT 10
$$;
GRANT EXECUTE ON FUNCTION my_pending_ready() TO authenticated;

-- ── 4. Tournament / league games: players can record results ─
-- Same as patch_brackets_challenges.sql, plus: the two sides can record their
-- own game, and any entrant can once the event date has passed. Every result
-- is announced to everyone in the event (except whoever entered it).
CREATE OR REPLACE FUNCTION record_match_result(p_match_id uuid, p_winner_id uuid, p_is_draw boolean, p_score text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me       uuid := auth.uid();
  m        tournament_matches%ROWTYPE;
  t        tournaments%ROWTYPE;
  nxt      tournament_matches%ROWTYPE;
  win_name text;
  champ    text;
  is_org   boolean;
  is_side  boolean;
  is_ent   boolean;
  my_name  text;
  summary  text;
BEGIN
  SELECT * INTO m FROM tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO t FROM tournaments WHERE id = m.tournament_id FOR UPDATE;

  is_org  := t.organiser_id IS NOT DISTINCT FROM me;
  is_side := me IN (m.a_id, m.b_id)
             OR EXISTS (SELECT 1 FROM teams tm WHERE tm.id IN (m.a_id, m.b_id) AND tm.owner_id = me);
  is_ent  := EXISTS (SELECT 1 FROM tournament_registrations r WHERE r.tournament_id = t.id AND r.user_id = me);
  IF NOT (is_org OR is_side OR (is_ent AND t.starts_on IS NOT NULL AND t.starts_on <= current_date)) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  IF t.status = 'active' THEN RAISE EXCEPTION 'NOT_STARTED'; END IF;
  IF m.a_id IS NULL OR m.b_id IS NULL THEN RAISE EXCEPTION 'MATCH_NOT_READY'; END IF;

  IF p_is_draw THEN
    IF t.type <> 'league' THEN RAISE EXCEPTION 'NO_DRAWS_IN_KNOCKOUT'; END IF;
  ELSIF p_winner_id IS DISTINCT FROM m.a_id AND p_winner_id IS DISTINCT FROM m.b_id THEN
    RAISE EXCEPTION 'INVALID_WINNER';
  END IF;

  IF t.type <> 'league' THEN
    SELECT * INTO nxt FROM tournament_matches
    WHERE tournament_id = m.tournament_id AND round = m.round + 1 AND slot = m.slot / 2
    FOR UPDATE;
    IF FOUND AND nxt.status = 'done' THEN RAISE EXCEPTION 'NEXT_ROUND_PLAYED'; END IF;
  END IF;

  UPDATE tournament_matches
  SET winner_id = CASE WHEN p_is_draw THEN NULL ELSE p_winner_id END,
      is_draw   = p_is_draw,
      score     = COALESCE(LEFT(p_score, 60), ''),
      status    = 'done'
  WHERE id = p_match_id;

  win_name := CASE WHEN p_winner_id = m.a_id THEN m.a_name ELSE m.b_name END;

  IF t.type <> 'league' THEN
    IF nxt.id IS NOT NULL THEN
      IF m.slot % 2 = 0 THEN
        UPDATE tournament_matches SET a_id = p_winner_id, a_name = win_name WHERE id = nxt.id;
      ELSE
        UPDATE tournament_matches SET b_id = p_winner_id, b_name = win_name WHERE id = nxt.id;
      END IF;
      UPDATE tournaments SET status = 'in_progress', champion_name = NULL WHERE id = t.id;
    ELSE
      UPDATE tournaments SET status = 'completed', champion_name = win_name WHERE id = t.id;
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM tournament_matches WHERE tournament_id = t.id AND status = 'pending') THEN
      SELECT s.name INTO champ FROM (
        SELECT a_id AS id, a_name AS name,
               CASE WHEN is_draw THEN 1 WHEN winner_id = a_id THEN 3 ELSE 0 END AS pts,
               CASE WHEN winner_id = a_id THEN 1 ELSE 0 END AS w
        FROM tournament_matches WHERE tournament_id = t.id AND status = 'done'
        UNION ALL
        SELECT b_id, b_name,
               CASE WHEN is_draw THEN 1 WHEN winner_id = b_id THEN 3 ELSE 0 END,
               CASE WHEN winner_id = b_id THEN 1 ELSE 0 END
        FROM tournament_matches WHERE tournament_id = t.id AND status = 'done'
      ) s
      GROUP BY s.id, s.name
      ORDER BY sum(s.pts) DESC, sum(s.w) DESC, s.name
      LIMIT 1;
      UPDATE tournaments SET status = 'completed', champion_name = champ WHERE id = t.id;
    ELSE
      UPDATE tournaments SET status = 'in_progress', champion_name = NULL WHERE id = t.id;
    END IF;
  END IF;

  -- Tell everyone in the event (popup + push), except whoever entered it
  SELECT name INTO my_name FROM profiles WHERE id = me;
  summary := m.a_name || ' vs ' || m.b_name || ': '
             || CASE WHEN p_is_draw THEN 'draw' ELSE win_name || ' won' END
             || CASE WHEN COALESCE(p_score, '') <> '' THEN ' (' || LEFT(p_score, 60) || ')' ELSE '' END;
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.user_id, 'match_result', '📝 Result · ' || t.name,
         COALESCE(my_name, 'A player') || ' recorded ' || summary || '.',
         jsonb_build_object('tournament_id', t.id, 'event_kind', 'event')
  FROM fn_event_people(t.id) p
  WHERE p.user_id IS DISTINCT FROM me;
END;
$$;
GRANT EXECUTE ON FUNCTION record_match_result(uuid, uuid, boolean, text) TO authenticated;

-- Start the draw: organiser, or any entrant once the event date has passed.
-- Same as patch_event_rules.sql otherwise.
CREATE OR REPLACE FUNCTION start_tournament(p_tournament_id uuid, p_matches jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me  uuid := auth.uid();
  t   tournaments%ROWTYPE;
  n   int;
BEGIN
  SELECT * INTO t FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF t.organiser_id IS DISTINCT FROM me
     AND NOT (t.starts_on IS NOT NULL AND t.starts_on <= current_date
              AND EXISTS (SELECT 1 FROM tournament_registrations r WHERE r.tournament_id = t.id AND r.user_id = me)) THEN
    RAISE EXCEPTION 'NOT_ORGANISER';
  END IF;
  IF COALESCE(t.status, 'active') <> 'active' THEN RAISE EXCEPTION 'ALREADY_STARTED'; END IF;

  SELECT count(*) INTO n FROM tournament_registrations WHERE tournament_id = p_tournament_id;
  IF n < GREATEST(t.min_participants, 4) THEN RAISE EXCEPTION 'NOT_ENOUGH_ENTRANTS'; END IF;

  DELETE FROM tournament_matches WHERE tournament_id = p_tournament_id;
  INSERT INTO tournament_matches (tournament_id, round, slot, a_id, a_name, b_id, b_name, winner_id, status)
  SELECT p_tournament_id, m.round, m.slot, m.a_id, m.a_name, m.b_id, m.b_name, m.winner_id, COALESCE(m.status, 'pending')
  FROM jsonb_to_recordset(p_matches) AS m(
    round int, slot int, a_id uuid, a_name text, b_id uuid, b_name text, winner_id uuid, status text
  );

  UPDATE tournaments SET status = 'in_progress' WHERE id = p_tournament_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.user_id, 'tournament_started', '🏆 ' || t.name || ' has started',
         CASE WHEN t.type = 'league' THEN 'Fixtures are out — see who you play.'
              ELSE 'The bracket is out — see who you play first.' END,
         jsonb_build_object('tournament_id', t.id)
  FROM fn_event_people(t.id) p
  WHERE p.user_id <> me;
END;
$$;
GRANT EXECUTE ON FUNCTION start_tournament(uuid, jsonb) TO authenticated;

-- ── 5. Final score + who won, for pickup games ──────────────
-- p_outcome is from the recorder's point of view: 'won' (my side won),
-- 'lost' (the other side won) or 'draw'. With exactly two players the
-- summary names the winner; otherwise it says whose side won.
CREATE OR REPLACE FUNCTION fn_result_summary(p_me uuid, p_outcome text, p_players uuid[])
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_name    text;
  other_name text;
BEGIN
  SELECT name INTO my_name FROM profiles WHERE id = p_me;
  my_name := COALESCE(my_name, 'A player');
  IF p_outcome = 'draw' THEN RETURN 'Draw'; END IF;
  IF array_length(p_players, 1) = 2 AND p_me = ANY (p_players) THEN
    SELECT name INTO other_name FROM profiles WHERE id = (SELECT x FROM unnest(p_players) x WHERE x <> p_me LIMIT 1);
    RETURN CASE WHEN p_outcome = 'won' THEN my_name ELSE COALESCE(other_name, 'Their opponent') END || ' won';
  END IF;
  RETURN CASE WHEN p_outcome = 'won' THEN my_name || '’s side won' ELSE my_name || '’s opponents won' END;
END;
$$;

-- Older version of this file had no outcome argument
DROP FUNCTION IF EXISTS record_event_result(uuid, text, text);
DROP FUNCTION IF EXISTS record_pickup_result(uuid, text, text);

-- Pickup "match" events (tournaments.type = 'match')
CREATE OR REPLACE FUNCTION record_event_result(p_id uuid, p_score text, p_note text, p_outcome text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me      uuid := auth.uid();
  t       tournaments%ROWTYPE;
  my_name text;
  summ    text;
BEGIN
  SELECT * INTO t FROM tournaments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF t.type <> 'match' THEN RAISE EXCEPTION 'NOT_A_MATCH'; END IF;
  IF NOT EXISTS (SELECT 1 FROM fn_event_people(t.id) WHERE user_id = me) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF NOT ((t.starts_on IS NOT NULL AND t.starts_on <= current_date)
          OR (t.starts_on IS NULL AND t.ready_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'TOO_EARLY';
  END IF;
  IF btrim(COALESCE(p_score, '')) = '' THEN RAISE EXCEPTION 'SCORE_REQUIRED'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('won', 'lost', 'draw') THEN RAISE EXCEPTION 'OUTCOME_REQUIRED'; END IF;

  summ := fn_result_summary(me, p_outcome,
            ARRAY(SELECT r.user_id FROM tournament_registrations r WHERE r.tournament_id = t.id));

  UPDATE tournaments
  SET result_score = LEFT(btrim(p_score), 60), result_note = LEFT(btrim(COALESCE(p_note, '')), 200),
      result_outcome = p_outcome, result_summary = summ,
      result_by = me, result_at = now(), status = 'completed'
  WHERE id = t.id;

  SELECT name INTO my_name FROM profiles WHERE id = me;
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.user_id, 'match_result', '📝 Final score · ' || t.name,
         summ || ' · ' || LEFT(btrim(p_score), 60) || ' (recorded by ' || COALESCE(my_name, 'a player') || ').',
         jsonb_build_object('tournament_id', t.id, 'event_kind', 'event')
  FROM fn_event_people(t.id) p
  WHERE p.user_id <> me;
END;
$$;
GRANT EXECUTE ON FUNCTION record_event_result(uuid, text, text, text) TO authenticated;

-- Organize Match games (matches table)
CREATE OR REPLACE FUNCTION record_pickup_result(p_id uuid, p_score text, p_note text, p_outcome text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me      uuid := auth.uid();
  m       matches%ROWTYPE;
  my_name text;
  summ    text;
BEGIN
  SELECT * INTO m FROM matches WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF m.status = 'cancelled' THEN RAISE EXCEPTION 'CANCELLED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM fn_match_people(m.id) WHERE user_id = me) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF NOT ((m.starts_on IS NOT NULL AND m.starts_on <= current_date)
          OR (m.starts_on IS NULL AND m.ready_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'TOO_EARLY';
  END IF;
  IF btrim(COALESCE(p_score, '')) = '' THEN RAISE EXCEPTION 'SCORE_REQUIRED'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('won', 'lost', 'draw') THEN RAISE EXCEPTION 'OUTCOME_REQUIRED'; END IF;

  summ := fn_result_summary(me, p_outcome,
            ARRAY(SELECT mp.player_id FROM match_players mp WHERE mp.match_id = m.id));

  UPDATE matches
  SET result_score = LEFT(btrim(p_score), 60), result_note = LEFT(btrim(COALESCE(p_note, '')), 200),
      result_outcome = p_outcome, result_summary = summ,
      result_by = me, result_at = now(), status = 'completed'
  WHERE id = m.id;

  SELECT name INTO my_name FROM profiles WHERE id = me;
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.user_id, 'match_result', '📝 Final score · ' || m.title,
         summ || ' · ' || LEFT(btrim(p_score), 60) || ' (recorded by ' || COALESCE(my_name, 'a player') || ').',
         jsonb_build_object('match_id', m.id, 'event_kind', 'match')
  FROM fn_match_people(m.id) p
  WHERE p.user_id <> me;
END;
$$;
GRANT EXECUTE ON FUNCTION record_pickup_result(uuid, text, text, text) TO authenticated;

COMMIT;
