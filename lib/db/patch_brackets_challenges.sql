-- ============================================================
-- MatchDay — Tournament brackets + Challenge matches
--
--  • Tournaments: players-or-teams entry, min/max sign-ups, format,
--    status flow  active (sign-ups open) → in_progress → completed
--  • tournament_matches: knockout bracket / league fixtures
--  • start_tournament() / record_match_result() RPCs (organiser only)
--  • challenges table + RPCs (player vs player, team vs team)
--  • Demo: 2 new demo players, 4 new demo football teams,
--    a tennis knockout in progress, a football team cup in progress,
--    a football league in progress, sign-ups on existing demo events.
--
-- Run once in Supabase SQL Editor. Safe to re-run. All-or-nothing.
-- Does not delete any existing data. Note: participants_count on
-- every tournament is recalculated from the real sign-ups.
-- ============================================================

BEGIN;

-- ── 1. Tournament settings ──────────────────────────────────
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entrant_type     text NOT NULL DEFAULT 'player'; -- 'player' | 'team'
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS min_participants int  NOT NULL DEFAULT 2;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS format           text NOT NULL DEFAULT '';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS champion_name    text;
-- status (existing column): 'active' = sign-ups open, 'in_progress', 'completed'

ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS tournament_registrations_team_uniq
  ON tournament_registrations (tournament_id, team_id) WHERE team_id IS NOT NULL;

-- Sign-up guard: open events only, not full, team events need a team you captain.
-- SECURITY DEFINER: as the signing-up user, row security hid the tournament row
-- from this trigger (and from the counter below), so neither worked for anyone
-- except the organiser.
CREATE OR REPLACE FUNCTION fn_tournament_capacity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t tournaments%ROWTYPE;
BEGIN
  SELECT * INTO t FROM tournaments WHERE id = NEW.tournament_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF COALESCE(t.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED';
  END IF;
  IF t.participants_count >= t.max_participants THEN
    RAISE EXCEPTION 'This event is full';
  END IF;
  IF t.entrant_type = 'team' THEN
    IF NEW.team_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM teams WHERE id = NEW.team_id AND owner_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'TEAM_REQUIRED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_tournament_participants_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tournaments SET participants_count = participants_count + 1 WHERE id = NEW.tournament_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tournaments SET participants_count = GREATEST(participants_count - 1, 0) WHERE id = OLD.tournament_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_participants ON tournament_registrations;
CREATE TRIGGER trg_tournament_participants
  AFTER INSERT OR DELETE ON tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION fn_tournament_participants_count();

-- Leaving is only possible while sign-ups are open
DROP POLICY IF EXISTS "tourney_reg_delete" ON tournament_registrations;
CREATE POLICY "tourney_reg_delete" ON tournament_registrations FOR DELETE USING (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND COALESCE(t.status, 'active') = 'active')
);

-- ── 2. Bracket / fixtures ───────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round         int  NOT NULL,             -- 1 = first round / matchday 1
  slot          int  NOT NULL,             -- position in the round, 0-based
  a_id          uuid, a_name text,         -- player id or team id
  b_id          uuid, b_name text,
  winner_id     uuid,
  is_draw       boolean NOT NULL DEFAULT false,
  score         text    NOT NULL DEFAULT '',
  status        text    NOT NULL DEFAULT 'pending',  -- 'pending' | 'done' | 'bye'
  UNIQUE (tournament_id, round, slot)
);
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournament_matches_select" ON tournament_matches;
CREATE POLICY "tournament_matches_select" ON tournament_matches FOR SELECT USING (true);
-- No insert/update policies: changes go through the RPCs below.

-- Organiser starts the event: closes sign-ups and saves the draw.
-- The draw itself is generated in the app (lib/bracket.ts) and passed as JSON.
CREATE OR REPLACE FUNCTION start_tournament(p_tournament_id uuid, p_matches jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t   tournaments%ROWTYPE;
  n   int;
BEGIN
  SELECT * INTO t FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF t.organiser_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'NOT_ORGANISER'; END IF;
  IF COALESCE(t.status, 'active') <> 'active' THEN RAISE EXCEPTION 'ALREADY_STARTED'; END IF;

  SELECT count(*) INTO n FROM tournament_registrations WHERE tournament_id = p_tournament_id;
  IF n < GREATEST(t.min_participants, 2) THEN RAISE EXCEPTION 'NOT_ENOUGH_ENTRANTS'; END IF;

  DELETE FROM tournament_matches WHERE tournament_id = p_tournament_id;
  INSERT INTO tournament_matches (tournament_id, round, slot, a_id, a_name, b_id, b_name, winner_id, status)
  SELECT p_tournament_id, m.round, m.slot, m.a_id, m.a_name, m.b_id, m.b_name, m.winner_id, COALESCE(m.status, 'pending')
  FROM jsonb_to_recordset(p_matches) AS m(
    round int, slot int, a_id uuid, a_name text, b_id uuid, b_name text, winner_id uuid, status text
  );

  UPDATE tournaments SET status = 'in_progress' WHERE id = p_tournament_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT r.user_id, 'tournament_started', '🏆 ' || t.name || ' has started',
         CASE WHEN t.type = 'league' THEN 'Fixtures are out — see who you play.'
              ELSE 'The bracket is out — see who you play first.' END,
         jsonb_build_object('tournament_id', t.id)
  FROM tournament_registrations r
  WHERE r.tournament_id = p_tournament_id AND r.user_id <> auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION start_tournament(uuid, jsonb) TO authenticated;

-- Organiser records a result. Knockout: winner moves into the next round.
CREATE OR REPLACE FUNCTION record_match_result(p_match_id uuid, p_winner_id uuid, p_is_draw boolean, p_score text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m        tournament_matches%ROWTYPE;
  t        tournaments%ROWTYPE;
  nxt      tournament_matches%ROWTYPE;
  win_name text;
  champ    text;
BEGIN
  SELECT * INTO m FROM tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT * INTO t FROM tournaments WHERE id = m.tournament_id FOR UPDATE;
  IF t.organiser_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'NOT_ORGANISER'; END IF;
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
      -- League table: 3 pts win, 1 draw; ties broken by wins, then name
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
END;
$$;
GRANT EXECUTE ON FUNCTION record_match_result(uuid, uuid, boolean, text) TO authenticated;

-- ── 3. Challenges ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL DEFAULT 'player',   -- 'player' | 'team'
  sport              text NOT NULL,
  challenger_id      uuid NOT NULL,                    -- player id or team id
  challenger_name    text NOT NULL,
  challenger_user_id uuid NOT NULL,                    -- who sent it (player / captain)
  opponent_id        uuid NOT NULL,
  opponent_name      text NOT NULL,
  opponent_user_id   uuid NOT NULL,                    -- who answers (player / captain)
  proposed_date      text NOT NULL DEFAULT 'TBD',
  location           text NOT NULL DEFAULT '',
  message            text NOT NULL DEFAULT '',
  status             text NOT NULL DEFAULT 'pending',  -- pending | accepted | declined | cancelled | completed
  winner_id          uuid,
  is_draw            boolean NOT NULL DEFAULT false,
  score              text NOT NULL DEFAULT '',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS challenges_challenger_user_idx ON challenges (challenger_user_id);
CREATE INDEX IF NOT EXISTS challenges_opponent_user_idx   ON challenges (opponent_user_id);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenges_select" ON challenges;
CREATE POLICY "challenges_select" ON challenges FOR SELECT
  USING (auth.uid() = challenger_user_id OR auth.uid() = opponent_user_id);
-- No write policies: all changes go through the RPCs below.

CREATE OR REPLACE FUNCTION create_challenge(
  p_kind text, p_sport text, p_challenger_team uuid, p_opponent_id uuid,
  p_date text, p_location text, p_message text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me         uuid := auth.uid();
  c_id       uuid;  c_name text;
  o_name     text;  o_user uuid;
  v_sport    text := p_sport;
  demo       boolean := false;
  new_id     uuid;
  new_status text := 'pending';
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_kind = 'team' THEN
    SELECT id, name, teams.sport INTO c_id, c_name, v_sport
    FROM teams WHERE id = p_challenger_team AND owner_id = me;
    IF c_id IS NULL THEN RAISE EXCEPTION 'NOT_CAPTAIN'; END IF;
    SELECT tm.name, tm.owner_id, COALESCE(p.is_demo, false) INTO o_name, o_user, demo
    FROM teams tm LEFT JOIN profiles p ON p.id = tm.owner_id
    WHERE tm.id = p_opponent_id AND tm.sport = v_sport;
    IF o_name IS NULL THEN RAISE EXCEPTION 'OPPONENT_NOT_FOUND'; END IF;
    IF p_opponent_id = c_id OR o_user = me THEN RAISE EXCEPTION 'CANNOT_CHALLENGE_SELF'; END IF;
  ELSE
    c_id := me;
    SELECT name INTO c_name FROM profiles WHERE id = me;
    SELECT name, id, COALESCE(is_demo, false) INTO o_name, o_user, demo FROM profiles WHERE id = p_opponent_id;
    IF o_name IS NULL THEN RAISE EXCEPTION 'OPPONENT_NOT_FOUND'; END IF;
    IF p_opponent_id = me THEN RAISE EXCEPTION 'CANNOT_CHALLENGE_SELF'; END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM challenges
    WHERE status IN ('pending', 'accepted')
      AND ((challenger_id = c_id AND opponent_id = p_opponent_id)
        OR (challenger_id = p_opponent_id AND opponent_id = c_id))
  ) THEN
    RAISE EXCEPTION 'ALREADY_CHALLENGED';
  END IF;

  -- Demo players/teams accept straight away so the flow can be tried end to end
  IF demo THEN new_status := 'accepted'; END IF;

  INSERT INTO challenges (kind, sport, challenger_id, challenger_name, challenger_user_id,
                          opponent_id, opponent_name, opponent_user_id,
                          proposed_date, location, message, status)
  VALUES (COALESCE(p_kind, 'player'), v_sport, c_id, COALESCE(c_name, 'Player'), me,
          p_opponent_id, o_name, o_user,
          COALESCE(NULLIF(p_date, ''), 'TBD'), COALESCE(p_location, ''), LEFT(COALESCE(p_message, ''), 300), new_status)
  RETURNING id INTO new_id;

  IF demo THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (me, 'challenge_update', '⚔️ Challenge accepted',
            o_name || ' accepted your ' || v_sport || ' challenge.',
            jsonb_build_object('challenge_id', new_id));
  ELSE
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (o_user, 'challenge', '⚔️ New challenge',
            c_name || ' challenged ' || CASE WHEN p_kind = 'team' THEN o_name ELSE 'you' END
                   || ' to a ' || v_sport || ' match.',
            jsonb_build_object('challenge_id', new_id));
  END IF;

  RETURN jsonb_build_object('id', new_id, 'status', new_status);
END;
$$;
GRANT EXECUTE ON FUNCTION create_challenge(text, text, uuid, uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION respond_challenge(p_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c challenges%ROWTYPE;
BEGIN
  SELECT * INTO c FROM challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR c.opponent_user_id <> auth.uid() THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'NOT_PENDING'; END IF;

  UPDATE challenges SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, updated_at = now()
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

CREATE OR REPLACE FUNCTION cancel_challenge(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c challenges%ROWTYPE; other uuid;
BEGIN
  SELECT * INTO c FROM challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() NOT IN (c.challenger_user_id, c.opponent_user_id) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF c.status NOT IN ('pending', 'accepted') THEN RAISE EXCEPTION 'NOT_ACTIVE'; END IF;

  UPDATE challenges SET status = 'cancelled', updated_at = now() WHERE id = p_id;

  other := CASE WHEN auth.uid() = c.challenger_user_id THEN c.opponent_user_id ELSE c.challenger_user_id END;
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (other, 'challenge_update', 'Challenge cancelled',
          'The ' || c.sport || ' challenge between ' || c.challenger_name || ' and ' || c.opponent_name || ' was cancelled.',
          jsonb_build_object('challenge_id', p_id));
END;
$$;
GRANT EXECUTE ON FUNCTION cancel_challenge(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION record_challenge_result(p_id uuid, p_winner_id uuid, p_is_draw boolean, p_score text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c challenges%ROWTYPE; other uuid; msg text;
BEGIN
  SELECT * INTO c FROM challenges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() NOT IN (c.challenger_user_id, c.opponent_user_id) THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF c.status <> 'accepted' THEN RAISE EXCEPTION 'NOT_ACCEPTED'; END IF;
  IF NOT p_is_draw AND p_winner_id IS DISTINCT FROM c.challenger_id AND p_winner_id IS DISTINCT FROM c.opponent_id THEN
    RAISE EXCEPTION 'INVALID_WINNER';
  END IF;

  UPDATE challenges
  SET status = 'completed',
      winner_id = CASE WHEN p_is_draw THEN NULL ELSE p_winner_id END,
      is_draw = p_is_draw,
      score = COALESCE(LEFT(p_score, 60), ''),
      updated_at = now()
  WHERE id = p_id;

  msg := CASE WHEN p_is_draw THEN 'It''s a draw'
              WHEN p_winner_id = c.challenger_id THEN c.challenger_name || ' won'
              ELSE c.opponent_name || ' won' END;
  other := CASE WHEN auth.uid() = c.challenger_user_id THEN c.opponent_user_id ELSE c.challenger_user_id END;
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (other, 'challenge_update', 'Challenge result recorded',
          msg || ' (' || c.challenger_name || ' vs ' || c.opponent_name || ').',
          jsonb_build_object('challenge_id', p_id));
END;
$$;
GRANT EXECUTE ON FUNCTION record_challenge_result(uuid, uuid, boolean, text) TO authenticated;

-- ── 4. Demo data ────────────────────────────────────────────
-- Two more demo players (so the tennis draw has 8)
INSERT INTO profiles (id, name, initials, avatar_color, bio, area, gender, privacy, is_demo, join_date, stats, latitude, longitude)
VALUES
  ('00000000-0000-0000-0000-000000000007','Daniel Park','DP','#0ea5e9','Big serve, bigger forehand. Always up for a hit.','Leslieville','male','public',true,'May 2024','{"matches":36,"wins":24,"rank":"Gold"}',43.6629,-79.3290),
  ('00000000-0000-0000-0000-000000000008','Priya Nair','PN','#f43f5e','Club tennis player. Loves long rallies and doubles.','North York','female','public',true,'Jul 2024','{"matches":29,"wins":19,"rank":"Silver"}',43.7615,-79.4111)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profile_sports (profile_id, sport, skill, emoji)
SELECT v.pid::uuid, 'Tennis', v.skill, '🎾'
FROM (VALUES ('00000000-0000-0000-0000-000000000007','Advanced'),
             ('00000000-0000-0000-0000-000000000008','Intermediate')) AS v(pid, skill)
WHERE NOT EXISTS (SELECT 1 FROM profile_sports ps WHERE ps.profile_id = v.pid::uuid AND ps.sport = 'Tennis');

-- Four more demo football teams
INSERT INTO teams (id, name, sport, description, area, owner_id, is_open, max_members) VALUES
  ('30000000-0000-0000-0000-000000000004', 'Liberty Village United', 'Football', 'Friendly 5-a-side crew, Tuesday nights.',   'Toronto',     '00000000-0000-0000-0000-000000000005', true, 12),
  ('30000000-0000-0000-0000-000000000005', 'Scarborough Lions',      'Football', 'Competitive squad, looking for a keeper.',  'Scarborough', '00000000-0000-0000-0000-000000000002', true, 14),
  ('30000000-0000-0000-0000-000000000006', 'Etobicoke Rangers',      'Football', 'Weekend league regulars since 2021.',       'Etobicoke',   '00000000-0000-0000-0000-000000000004', true, 14),
  ('30000000-0000-0000-0000-000000000007', 'North York Galaxy',      'Football', 'Fast, fun and always on time.',             'North York',  '00000000-0000-0000-0000-000000000006', true, 12)
ON CONFLICT (id) DO NOTHING;

-- Demo events: settings for the existing ones
UPDATE tournaments SET entrant_type = 'team',   min_participants = 4, format = '11v11'   WHERE id = '20000000-0000-0000-0000-000000000001'; -- league
UPDATE tournaments SET entrant_type = 'team',   min_participants = 4, format = '11v11'   WHERE id = '20000000-0000-0000-0000-000000000002'; -- cricket cup
UPDATE tournaments SET entrant_type = 'player', min_participants = 4                    WHERE id = '20000000-0000-0000-0000-000000000003'; -- tennis
UPDATE tournaments SET entrant_type = 'player', min_participants = 10, format = '11v11'  WHERE id = '20000000-0000-0000-0000-000000000004'; -- pickup

-- Two new demo tournaments (inserted as 'active' so sign-ups can be added)
INSERT INTO tournaments (id, name, type, sport, sport_emoji, date_text, location, max_participants, min_participants,
                         entry_fee, prize_pool, entrant_type, format, status)
VALUES
  ('20000000-0000-0000-0000-000000000005', 'Toronto Open — Tennis Singles', 'tournament', 'Tennis', '🎾',
   'Sat, Oct 17, 2026', 'High Park Tennis Courts', 8, 4, 25, 400, 'player', 'Singles', 'active'),
  ('20000000-0000-0000-0000-000000000006', 'GTA 5-a-side Knockout Cup', 'tournament', 'Football', '⚽',
   'Sun, Oct 25, 2026', 'Lamport Stadium', 8, 4, 60, 1000, 'team', '5v5', 'active')
ON CONFLICT (id) DO NOTHING;

-- Sign-ups (guard/count triggers paused while seeding; counts recalculated below)
ALTER TABLE tournament_registrations DISABLE TRIGGER USER;

INSERT INTO tournament_registrations (tournament_id, user_id, team_id) VALUES
  -- Toronto Open (8 players)
  ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001',NULL),
  ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002',NULL),
  ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000003',NULL),
  ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004',NULL),
  ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000005',NULL),
  ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006',NULL),
  ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000007',NULL),
  ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000008',NULL),
  -- 5-a-side Knockout Cup (5 teams → 3 byes)
  ('20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000005'),
  ('20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000006'),
  ('20000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000007'),
  -- Premier Football League (5 teams, round robin)
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000005'),
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000006'),
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000007'),
  -- GTA Cricket Cup (sign-ups open)
  ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003'),
  -- Tennis Doubles Showdown (sign-ups open)
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',NULL),
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000006',NULL),
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000007',NULL),
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000008',NULL)
ON CONFLICT DO NOTHING;

ALTER TABLE tournament_registrations ENABLE TRIGGER USER;

UPDATE tournaments t
SET participants_count = (SELECT count(*) FROM tournament_registrations r WHERE r.tournament_id = t.id);

-- Toronto Open bracket: quarter-finals done, one semi-final done, final waiting
INSERT INTO tournament_matches (tournament_id, round, slot, a_id, a_name, b_id, b_name, winner_id, score, status) VALUES
  ('20000000-0000-0000-0000-000000000005',1,0,'00000000-0000-0000-0000-000000000002','Sara Ahmed',   '00000000-0000-0000-0000-000000000007','Daniel Park', '00000000-0000-0000-0000-000000000002','6-3 6-4','done'),
  ('20000000-0000-0000-0000-000000000005',1,1,'00000000-0000-0000-0000-000000000006','Zara Siddiqui','00000000-0000-0000-0000-000000000001','Ali Hassan',  '00000000-0000-0000-0000-000000000006','6-2 7-5','done'),
  ('20000000-0000-0000-0000-000000000005',1,2,'00000000-0000-0000-0000-000000000008','Priya Nair',   '00000000-0000-0000-0000-000000000005','Usman Tariq', '00000000-0000-0000-0000-000000000008','6-4 3-6 6-3','done'),
  ('20000000-0000-0000-0000-000000000005',1,3,'00000000-0000-0000-0000-000000000003','Bilal Khan',   '00000000-0000-0000-0000-000000000004','Fatima Rizvi','00000000-0000-0000-0000-000000000004','6-7 6-4 6-2','done'),
  ('20000000-0000-0000-0000-000000000005',2,0,'00000000-0000-0000-0000-000000000002','Sara Ahmed',   '00000000-0000-0000-0000-000000000006','Zara Siddiqui','00000000-0000-0000-0000-000000000006','4-6 6-3 6-2','done'),
  ('20000000-0000-0000-0000-000000000005',2,1,'00000000-0000-0000-0000-000000000008','Priya Nair',   '00000000-0000-0000-0000-000000000004','Fatima Rizvi', NULL,'','pending'),
  ('20000000-0000-0000-0000-000000000005',3,0,'00000000-0000-0000-0000-000000000006','Zara Siddiqui', NULL, NULL, NULL,'','pending')
ON CONFLICT (tournament_id, round, slot) DO NOTHING;

-- 5-a-side Cup bracket: 3 byes, one first-round game played
INSERT INTO tournament_matches (tournament_id, round, slot, a_id, a_name, b_id, b_name, winner_id, score, status) VALUES
  ('20000000-0000-0000-0000-000000000006',1,0,'30000000-0000-0000-0000-000000000001','High Park FC',          NULL, NULL, '30000000-0000-0000-0000-000000000001','','bye'),
  ('20000000-0000-0000-0000-000000000006',1,1,'30000000-0000-0000-0000-000000000004','Liberty Village United','30000000-0000-0000-0000-000000000005','Scarborough Lions','30000000-0000-0000-0000-000000000004','3-2','done'),
  ('20000000-0000-0000-0000-000000000006',1,2,'30000000-0000-0000-0000-000000000006','Etobicoke Rangers',     NULL, NULL, '30000000-0000-0000-0000-000000000006','','bye'),
  ('20000000-0000-0000-0000-000000000006',1,3,'30000000-0000-0000-0000-000000000007','North York Galaxy',     NULL, NULL, '30000000-0000-0000-0000-000000000007','','bye'),
  ('20000000-0000-0000-0000-000000000006',2,0,'30000000-0000-0000-0000-000000000001','High Park FC',          '30000000-0000-0000-0000-000000000004','Liberty Village United', NULL,'','pending'),
  ('20000000-0000-0000-0000-000000000006',2,1,'30000000-0000-0000-0000-000000000006','Etobicoke Rangers',     '30000000-0000-0000-0000-000000000007','North York Galaxy',      NULL,'','pending'),
  ('20000000-0000-0000-0000-000000000006',3,0, NULL, NULL, NULL, NULL, NULL,'','pending')
ON CONFLICT (tournament_id, round, slot) DO NOTHING;

-- Premier League fixtures: 5 teams, 5 matchdays (one team rests each week), first 2 played
INSERT INTO tournament_matches (tournament_id, round, slot, a_id, a_name, b_id, b_name, winner_id, is_draw, score, status) VALUES
  ('20000000-0000-0000-0000-000000000001',1,0,'30000000-0000-0000-0000-000000000004','Liberty Village United','30000000-0000-0000-0000-000000000007','North York Galaxy','30000000-0000-0000-0000-000000000004',false,'2-1','done'),
  ('20000000-0000-0000-0000-000000000001',1,1,'30000000-0000-0000-0000-000000000005','Scarborough Lions','30000000-0000-0000-0000-000000000006','Etobicoke Rangers',NULL,true,'1-1','done'),
  ('20000000-0000-0000-0000-000000000001',2,0,'30000000-0000-0000-0000-000000000001','High Park FC','30000000-0000-0000-0000-000000000005','Scarborough Lions','30000000-0000-0000-0000-000000000001',false,'3-0','done'),
  ('20000000-0000-0000-0000-000000000001',2,1,'30000000-0000-0000-0000-000000000006','Etobicoke Rangers','30000000-0000-0000-0000-000000000007','North York Galaxy','30000000-0000-0000-0000-000000000006',false,'2-0','done'),
  ('20000000-0000-0000-0000-000000000001',3,0,'30000000-0000-0000-0000-000000000004','Liberty Village United','30000000-0000-0000-0000-000000000006','Etobicoke Rangers',NULL,false,'','pending'),
  ('20000000-0000-0000-0000-000000000001',3,1,'30000000-0000-0000-0000-000000000001','High Park FC','30000000-0000-0000-0000-000000000007','North York Galaxy',NULL,false,'','pending'),
  ('20000000-0000-0000-0000-000000000001',4,0,'30000000-0000-0000-0000-000000000005','Scarborough Lions','30000000-0000-0000-0000-000000000007','North York Galaxy',NULL,false,'','pending'),
  ('20000000-0000-0000-0000-000000000001',4,1,'30000000-0000-0000-0000-000000000001','High Park FC','30000000-0000-0000-0000-000000000004','Liberty Village United',NULL,false,'','pending'),
  ('20000000-0000-0000-0000-000000000001',5,0,'30000000-0000-0000-0000-000000000001','High Park FC','30000000-0000-0000-0000-000000000006','Etobicoke Rangers',NULL,false,'','pending'),
  ('20000000-0000-0000-0000-000000000001',5,1,'30000000-0000-0000-0000-000000000004','Liberty Village United','30000000-0000-0000-0000-000000000005','Scarborough Lions',NULL,false,'','pending')
ON CONFLICT (tournament_id, round, slot) DO NOTHING;

UPDATE tournaments SET status = 'in_progress'
WHERE id IN ('20000000-0000-0000-0000-000000000001',
             '20000000-0000-0000-0000-000000000005',
             '20000000-0000-0000-0000-000000000006')
  AND status = 'active';

COMMIT;
