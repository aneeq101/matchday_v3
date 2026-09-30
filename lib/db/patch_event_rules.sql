-- ============================================================
-- MatchDay — sensible sign-up limits for tournaments & leagues
--
--  • Knockouts and leagues need at least 4 entrants, max ≥ min, max ≤ 64
--  • New events: who signs up must fit the sport —
--      Tennis/Badminton singles → players, doubles → pairs (2-player teams),
--      Football/Cricket/Basketball/Baseball → teams
--  • start_tournament() never starts with fewer than 4
--  • Existing events brought in line:
--      - any tournament/league with min < 4 → min 4 (max raised to 4 if lower)
--      - demo "Tennis Doubles Showdown" becomes a real doubles event:
--        4 demo pairs replace the 4 demo single-player sign-ups
--    (only demo sign-ups are removed; no real user's sign-up is touched)
--
-- Run once in Supabase SQL Editor. Safe to re-run. All-or-nothing.
-- ============================================================

BEGIN;

-- ── 1. Bring existing events in line (before the check exists) ──
UPDATE tournaments
SET min_participants = 4,
    max_participants = GREATEST(max_participants, 4)
WHERE type IN ('tournament', 'league') AND min_participants < 4;

UPDATE tournaments
SET max_participants = GREATEST(max_participants, min_participants)
WHERE type IN ('tournament', 'league') AND max_participants < min_participants;

-- ── 2. Server-side check ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_tournaments_validate()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  racquet boolean := NEW.sport IN ('Tennis', 'Badminton');
  doubles boolean := lower(COALESCE(NEW.format, '')) = 'doubles';
BEGIN
  IF NEW.type IN ('tournament', 'league') THEN
    IF NEW.min_participants < 4 THEN RAISE EXCEPTION 'MIN_TOO_LOW'; END IF;
    IF NEW.max_participants < NEW.min_participants THEN RAISE EXCEPTION 'MAX_BELOW_MIN'; END IF;
    IF NEW.max_participants > 64 THEN RAISE EXCEPTION 'MAX_TOO_HIGH'; END IF;
    -- Entry type is checked for new events only, so older events keep their sign-ups
    IF TG_OP = 'INSERT' THEN
      IF racquet AND NOT doubles AND NEW.entrant_type <> 'player' THEN RAISE EXCEPTION 'ENTRANT_MISMATCH'; END IF;
      IF (NOT racquet OR doubles) AND NEW.entrant_type <> 'team' THEN RAISE EXCEPTION 'ENTRANT_MISMATCH'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournaments_validate ON tournaments;
CREATE TRIGGER trg_tournaments_validate
  BEFORE INSERT OR UPDATE OF min_participants, max_participants, type, sport, format, entrant_type ON tournaments
  FOR EACH ROW EXECUTE FUNCTION fn_tournaments_validate();

-- ── 3. start_tournament: floor of 4 ─────────────────────────
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
  IF n < GREATEST(t.min_participants, 4) THEN RAISE EXCEPTION 'NOT_ENOUGH_ENTRANTS'; END IF;

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

-- ── 4. Demo: Tennis Doubles Showdown → real doubles (pairs) ──
INSERT INTO teams (id, name, sport, description, area, owner_id, is_open, max_members) VALUES
  ('30000000-0000-0000-0000-000000000008', 'Sara & Zara',      'Tennis', 'Doubles pair.', 'Toronto',    '00000000-0000-0000-0000-000000000002', false, 2),
  ('30000000-0000-0000-0000-000000000009', 'Daniel & Priya',   'Tennis', 'Doubles pair.', 'Toronto',    '00000000-0000-0000-0000-000000000007', false, 2),
  ('30000000-0000-0000-0000-000000000010', 'Ali & Usman',      'Tennis', 'Doubles pair.', 'Toronto',    '00000000-0000-0000-0000-000000000001', false, 2),
  ('30000000-0000-0000-0000-000000000011', 'Bilal & Fatima',   'Tennis', 'Doubles pair.', 'Mississauga','00000000-0000-0000-0000-000000000003', false, 2)
ON CONFLICT (id) DO NOTHING;

-- NOT EXISTS (not ON CONFLICT): the team-size trigger runs before conflict
-- handling, so re-adding a partner to a full pair would fail on a re-run.
INSERT INTO team_members (team_id, user_id, role)
SELECT v.team_id::uuid, v.user_id::uuid, 'member'
FROM (VALUES
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000006'),
  ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000008'),
  ('30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004')
) AS v(team_id, user_id)
WHERE NOT EXISTS (
  SELECT 1 FROM team_members tm WHERE tm.team_id = v.team_id::uuid AND tm.user_id = v.user_id::uuid
);

ALTER TABLE tournament_registrations DISABLE TRIGGER USER;

-- Remove only the demo players' single sign-ups (real users untouched)
DELETE FROM tournament_registrations
WHERE tournament_id = '20000000-0000-0000-0000-000000000003'
  AND team_id IS NULL
  AND user_id IN (SELECT id FROM profiles WHERE is_demo);

INSERT INTO tournament_registrations (tournament_id, user_id, team_id) VALUES
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000008'),
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000009'),
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000010'),
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000011')
ON CONFLICT DO NOTHING;

ALTER TABLE tournament_registrations ENABLE TRIGGER USER;

-- Only switch it to pairs if no real (non-demo) player is signed up as an individual
UPDATE tournaments SET entrant_type = 'team', format = 'Doubles'
WHERE id = '20000000-0000-0000-0000-000000000003'
  AND NOT EXISTS (
    SELECT 1 FROM tournament_registrations r
    WHERE r.tournament_id = '20000000-0000-0000-0000-000000000003' AND r.team_id IS NULL
  );

UPDATE tournaments t
SET participants_count = (SELECT count(*) FROM tournament_registrations r WHERE r.tournament_id = t.id);

COMMIT;
