-- ============================================================
-- MatchDay — Skill ratings, reviews and badges
--
--  • ratings: a player (or a team, via its captain) rates a player
--    or a team in one sport — overall level 1–10 (required),
--    per-skill levels 1–10 (optional, keys from lib/ratingRules.ts),
--    sportsmanship + reliability 1–5 (optional), written review.
--    One rating per rater per target per sport; rating again updates it.
--  • played_together is worked out by the database (completed
--    challenge / tournament match between them, same team, same
--    pickup match) and shown as "Played together" on the review.
--  • Badges (Bronze 5+, Silver 6+, Gold 7+, Platinum 8+, Diamond 9+):
--    at least 3 different people rated the overall at that level or
--    higher, AND they are at least half of everyone who rated that
--    sport. Only the last 12 months count. A person who rated both as
--    themselves and as their team counts once (their average).
--  • submit_rating() RPC validates everything and notifies the rated
--    player / team captain, including when a new badge is earned.
--  • rating_summary() RPC: per-sport averages, badge, progress counts.
--  • Demo ratings for the demo players and teams.
--
-- Run once in Supabase SQL Editor. Safe to re-run. All-or-nothing.
-- Does not change or delete any existing data.
-- ============================================================

BEGIN;

-- ── 1. Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- who submitted it
  rater_team      uuid REFERENCES teams(id) ON DELETE CASCADE,              -- set when rating on behalf of a team
  rater_name      text NOT NULL DEFAULT '',
  target_player   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  target_team     uuid REFERENCES teams(id) ON DELETE CASCADE,
  sport           text NOT NULL,
  overall         smallint NOT NULL CHECK (overall BETWEEN 1 AND 10),
  skills          jsonb NOT NULL DEFAULT '{}'::jsonb,                       -- {"forehand": 7, "serve": 8}
  sportsmanship   smallint CHECK (sportsmanship BETWEEN 1 AND 5),
  reliability     smallint CHECK (reliability BETWEEN 1 AND 5),
  review          text NOT NULL DEFAULT '' CHECK (char_length(review) <= 500),
  played_together boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((target_player IS NULL) <> (target_team IS NULL))
);

-- One rating per rater (a person, or a team whoever its captain is) per target per sport
CREATE UNIQUE INDEX IF NOT EXISTS ratings_one_per_rater
  ON ratings ((COALESCE(rater_team, rater_user_id)), (COALESCE(target_player, target_team)), sport);
CREATE INDEX IF NOT EXISTS ratings_target_player_idx ON ratings (target_player, sport) WHERE target_player IS NOT NULL;
CREATE INDEX IF NOT EXISTS ratings_target_team_idx   ON ratings (target_team, sport)   WHERE target_team IS NOT NULL;

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings of teams, and of players whose profile they can see
-- (the profiles policy applies inside the sub-select, so "Friends Only" holds).
DROP POLICY IF EXISTS "ratings_select" ON ratings;
CREATE POLICY "ratings_select" ON ratings FOR SELECT USING (
  target_team IS NOT NULL
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = target_player)
);

-- Raters can delete their own rating (or their team's, if they captain it)
DROP POLICY IF EXISTS "ratings_delete" ON ratings;
CREATE POLICY "ratings_delete" ON ratings FOR DELETE USING (
  rater_user_id = auth.uid()
  OR rater_team IN (SELECT id FROM teams WHERE owner_id = auth.uid())
);
-- No insert/update policies: writes go through submit_rating().

-- ── 2. Badge tiers (keep in step with BADGE_TIERS in lib/ratingRules.ts) ──
CREATE OR REPLACE FUNCTION fn_rating_tiers()
RETURNS TABLE (tier text, min_level int, tier_rank int) LANGUAGE sql IMMUTABLE AS $$
  VALUES ('bronze', 5, 1), ('silver', 6, 2), ('gold', 7, 3), ('platinum', 8, 4), ('diamond', 9, 5)
$$;

-- ── 3. Summary per sport (badge rule lives here, nowhere else) ──
-- SECURITY INVOKER: row security on ratings applies to the caller.
CREATE OR REPLACE FUNCTION rating_summary(p_kind text, p_id uuid)
RETURNS TABLE (
  sport text, raters int, avg_overall numeric, badge text, tier_counts jsonb,
  skills jsonb, sportsmanship numeric, reliability numeric, verified int, reviews int
) LANGUAGE sql STABLE SET search_path = public AS $$
  WITH cur AS (
    SELECT r.* FROM ratings r
    WHERE (CASE WHEN p_kind = 'team' THEN r.target_team ELSE r.target_player END) = p_id
      AND r.updated_at > now() - interval '365 days'
  ),
  people AS (      -- one voice per person
    SELECT c.sport, c.rater_user_id, avg(c.overall) AS overall
    FROM cur c GROUP BY c.sport, c.rater_user_id
  ),
  counts AS (
    SELECT s.sport, t.tier, t.tier_rank,
           count(pp.rater_user_id) FILTER (WHERE pp.overall >= t.min_level) AS n,
           count(pp.rater_user_id) AS total
    FROM (SELECT DISTINCT c.sport FROM cur c) s
    CROSS JOIN fn_rating_tiers() t
    LEFT JOIN people pp ON pp.sport = s.sport
    GROUP BY s.sport, t.tier, t.tier_rank
  )
  SELECT
    s.sport,
    (SELECT count(*)::int FROM people pp WHERE pp.sport = s.sport),
    (SELECT round(avg(pp.overall), 1) FROM people pp WHERE pp.sport = s.sport),
    (SELECT k.tier FROM counts k
      WHERE k.sport = s.sport AND k.n >= 3 AND k.n * 2 >= k.total
      ORDER BY k.tier_rank DESC LIMIT 1),
    (SELECT jsonb_object_agg(k.tier, k.n) FROM counts k WHERE k.sport = s.sport),
    COALESCE((
      SELECT jsonb_object_agg(x.key, x.avg)
      FROM (
        SELECT e.key, round(avg(e.value::numeric), 1) AS avg
        FROM cur c, jsonb_each_text(c.skills) e
        WHERE c.sport = s.sport
        GROUP BY e.key
      ) x
    ), '{}'::jsonb),
    (SELECT round(avg(c.sportsmanship), 1) FROM cur c WHERE c.sport = s.sport),
    (SELECT round(avg(c.reliability), 1)   FROM cur c WHERE c.sport = s.sport),
    (SELECT count(*)::int FROM cur c WHERE c.sport = s.sport AND c.played_together),
    (SELECT count(*)::int FROM cur c WHERE c.sport = s.sport AND c.review <> '')
  FROM (SELECT DISTINCT c.sport FROM cur c) s
  ORDER BY 2 DESC, 1
$$;
GRANT EXECUTE ON FUNCTION rating_summary(text, uuid) TO anon, authenticated;

-- ── 4. Have they actually played each other? ────────────────
-- Rater side: the team they rate for, or themselves + their teams.
-- Target side: the team, or the player + their teams.
CREATE OR REPLACE FUNCTION fn_played_together(p_user uuid, p_as_team uuid, p_kind text, p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH a AS (
    SELECT p_as_team AS id WHERE p_as_team IS NOT NULL
    UNION SELECT p_user WHERE p_as_team IS NULL
    UNION SELECT tm.team_id FROM team_members tm WHERE tm.user_id = p_user AND p_as_team IS NULL
  ), b AS (
    SELECT p_target AS id
    UNION SELECT tm.team_id FROM team_members tm WHERE tm.user_id = p_target AND p_kind = 'player'
  )
  SELECT
    EXISTS (
      SELECT 1 FROM challenges c
      WHERE c.status = 'completed'
        AND ((c.challenger_id IN (SELECT id FROM a) AND c.opponent_id IN (SELECT id FROM b))
          OR (c.challenger_id IN (SELECT id FROM b) AND c.opponent_id IN (SELECT id FROM a)))
    )
    OR EXISTS (
      SELECT 1 FROM tournament_matches m
      WHERE m.status = 'done'
        AND ((m.a_id IN (SELECT id FROM a) AND m.b_id IN (SELECT id FROM b))
          OR (m.a_id IN (SELECT id FROM b) AND m.b_id IN (SELECT id FROM a)))
    )
    OR (p_kind = 'player' AND p_as_team IS NULL AND (
      EXISTS (SELECT 1 FROM team_members x JOIN team_members y ON y.team_id = x.team_id
              WHERE x.user_id = p_user AND y.user_id = p_target)
      OR EXISTS (SELECT 1 FROM match_players x JOIN match_players y ON y.match_id = x.match_id
                 WHERE x.player_id = p_user AND y.player_id = p_target)
    ))
$$;

-- ── 5. Submit / update a rating ─────────────────────────────
CREATE OR REPLACE FUNCTION submit_rating(
  p_as_team uuid,                 -- NULL = as yourself, else a team you captain
  p_target_kind text,             -- 'player' | 'team'
  p_target_id uuid,
  p_sport text,                   -- ignored for teams (the team's sport is used)
  p_overall int,
  p_skills jsonb,
  p_sportsmanship int,
  p_reliability int,
  p_review text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me           uuid := auth.uid();
  v_sport      text := p_sport;
  r_name       text;
  r_team       teams%ROWTYPE;
  t_team       teams%ROWTYPE;
  t_name       text;
  t_user       uuid;
  t_demo       boolean := false;
  clean        jsonb := '{}'::jsonb;
  e            record;
  before_badge text;
  after_badge  text;
  rank_before  int;
  rank_after   int;
  played       boolean;
  row_id       uuid;
  is_new       boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_target_kind NOT IN ('player', 'team') THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
  IF p_overall IS NULL OR p_overall NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'INVALID_RATING'; END IF;
  IF p_sportsmanship IS NOT NULL AND p_sportsmanship NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'INVALID_RATING'; END IF;
  IF p_reliability   IS NOT NULL AND p_reliability   NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'INVALID_RATING'; END IF;
  IF char_length(COALESCE(p_review, '')) > 500 THEN RAISE EXCEPTION 'REVIEW_TOO_LONG'; END IF;

  -- Target
  IF p_target_kind = 'team' THEN
    SELECT * INTO t_team FROM teams WHERE id = p_target_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
    v_sport := t_team.sport;
    t_name  := t_team.name;
    t_user  := t_team.owner_id;
    IF p_target_id = p_as_team
       OR EXISTS (SELECT 1 FROM team_members WHERE team_id = p_target_id AND user_id = me) THEN
      RAISE EXCEPTION 'CANNOT_RATE_OWN';
    END IF;
  ELSE
    SELECT name, id INTO t_name, t_user FROM profiles WHERE id = p_target_id;
    IF t_user IS NULL THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
    IF p_target_id = me THEN RAISE EXCEPTION 'CANNOT_RATE_SELF'; END IF;
  END IF;
  SELECT COALESCE(is_demo, false) INTO t_demo FROM profiles WHERE id = t_user;

  IF v_sport NOT IN ('Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball', 'Hockey') THEN
    RAISE EXCEPTION 'INVALID_SPORT';
  END IF;

  -- Rater
  IF p_as_team IS NOT NULL THEN
    SELECT * INTO r_team FROM teams WHERE id = p_as_team AND owner_id = me;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_CAPTAIN'; END IF;
    IF r_team.sport <> v_sport THEN RAISE EXCEPTION 'SPORT_MISMATCH'; END IF;
    IF p_target_kind = 'player'
       AND EXISTS (SELECT 1 FROM team_members WHERE team_id = p_as_team AND user_id = p_target_id) THEN
      RAISE EXCEPTION 'CANNOT_RATE_OWN';
    END IF;
    r_name := r_team.name;
  ELSE
    SELECT name INTO r_name FROM profiles WHERE id = me;
  END IF;

  -- Keep only well-formed skill scores (whole numbers 1–10)
  IF jsonb_typeof(p_skills) = 'object' THEN
    FOR e IN SELECT key, value FROM jsonb_each(p_skills) LIMIT 30 LOOP
      IF e.key ~ '^[a-z_]{1,30}$' AND jsonb_typeof(e.value) = 'number'
         AND (e.value::text)::numeric BETWEEN 1 AND 10 THEN
        clean := clean || jsonb_build_object(e.key, round((e.value::text)::numeric)::int);
      END IF;
    END LOOP;
  END IF;

  played := fn_played_together(me, p_as_team, p_target_kind, p_target_id);

  SELECT s.badge INTO before_badge FROM rating_summary(p_target_kind, p_target_id) s WHERE s.sport = v_sport;

  UPDATE ratings
  SET rater_user_id = me, rater_name = COALESCE(r_name, 'Player'),
      overall = p_overall, skills = clean,
      sportsmanship = p_sportsmanship, reliability = p_reliability,
      review = btrim(COALESCE(p_review, '')), played_together = played, updated_at = now()
  WHERE COALESCE(rater_team, rater_user_id) = COALESCE(p_as_team, me)
    AND COALESCE(target_player, target_team) = p_target_id
    AND sport = v_sport
  RETURNING id INTO row_id;

  IF row_id IS NULL THEN
    is_new := true;
    INSERT INTO ratings (rater_user_id, rater_team, rater_name, target_player, target_team, sport,
                         overall, skills, sportsmanship, reliability, review, played_together)
    VALUES (me, p_as_team, COALESCE(r_name, 'Player'),
            CASE WHEN p_target_kind = 'player' THEN p_target_id END,
            CASE WHEN p_target_kind = 'team'   THEN p_target_id END,
            v_sport, p_overall, clean, p_sportsmanship, p_reliability,
            btrim(COALESCE(p_review, '')), played)
    RETURNING id INTO row_id;
  END IF;

  SELECT s.badge INTO after_badge FROM rating_summary(p_target_kind, p_target_id) s WHERE s.sport = v_sport;
  SELECT tier_rank INTO rank_before FROM fn_rating_tiers() WHERE tier = before_badge;
  SELECT tier_rank INTO rank_after  FROM fn_rating_tiers() WHERE tier = after_badge;

  IF NOT t_demo AND t_user <> me THEN
    IF is_new THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (t_user, 'new_rating', '⭐ New ' || v_sport || ' rating',
              r_name || ' rated ' || CASE WHEN p_target_kind = 'team' THEN t_name ELSE 'you' END
                     || ' ' || p_overall || '/10'
                     || CASE WHEN btrim(COALESCE(p_review, '')) <> '' THEN ' and left a review.' ELSE '.' END,
              CASE WHEN p_target_kind = 'team' THEN jsonb_build_object('team_id', p_target_id)
                   ELSE jsonb_build_object('rating_player_id', p_target_id) END);
    END IF;
    IF COALESCE(rank_after, 0) > COALESCE(rank_before, 0) THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (t_user, 'new_badge', '🏅 ' || initcap(after_badge) || ' badge earned',
              CASE WHEN p_target_kind = 'team' THEN t_name || ' is' ELSE 'You''re' END
                || ' now rated ' || initcap(after_badge) || ' in ' || v_sport || '.',
              CASE WHEN p_target_kind = 'team' THEN jsonb_build_object('team_id', p_target_id)
                   ELSE jsonb_build_object('rating_player_id', p_target_id) END);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', row_id, 'is_new', is_new, 'badge', after_badge,
    'badge_up', COALESCE(rank_after, 0) > COALESCE(rank_before, 0),
    'played_together', played
  );
END;
$$;
GRANT EXECUTE ON FUNCTION submit_rating(uuid, text, uuid, text, int, jsonb, int, int, text) TO authenticated;

-- ── 6. Demo ratings ─────────────────────────────────────────
-- Inserted directly (the RPC needs a signed-in user). Names come from the
-- rater's profile or team. ON CONFLICT keeps re-runs from duplicating.
INSERT INTO ratings (rater_user_id, rater_team, rater_name, target_player, target_team, sport,
                     overall, skills, sportsmanship, reliability, review, played_together, created_at, updated_at)
SELECT v.rater::uuid, v.rteam::uuid,
       COALESCE((SELECT name FROM teams WHERE id = v.rteam::uuid), (SELECT name FROM profiles WHERE id = v.rater::uuid), 'Player'),
       v.tplayer::uuid, v.tteam::uuid, v.sport, v.overall, v.skills::jsonb, v.sm, v.rel, v.review,
       fn_played_together(v.rater::uuid, v.rteam::uuid,
                          CASE WHEN v.tteam IS NULL THEN 'player' ELSE 'team' END,
                          COALESCE(v.tplayer, v.tteam)::uuid),
       now() - (v.days || ' days')::interval, now() - (v.days || ' days')::interval
FROM (VALUES
  -- Daniel Park · Tennis → Platinum (4 of 5 at 8+)
  ('00000000-0000-0000-0000-000000000001', NULL, '00000000-0000-0000-0000-000000000007', NULL, 'Tennis', 8,
   '{"serve":9,"return":7,"forehand":9,"backhand":7,"volley":6,"overhead":8,"topspin":9,"movement":7,"consistency":8,"mental":8}', 5, 5,
   'Serve is a weapon — had no answer to the kick serve out wide. Forehand is heavy too.', 12),
  ('00000000-0000-0000-0000-000000000002', NULL, '00000000-0000-0000-0000-000000000007', NULL, 'Tennis', 8,
   '{"serve":9,"forehand":8,"backhand":7,"volley":7,"topspin":8,"slice":6,"movement":8,"tactics":7}', 5, 4,
   'Great hitting partner. Backhand breaks down a little on high balls but everything else is solid.', 30),
  ('00000000-0000-0000-0000-000000000003', NULL, '00000000-0000-0000-0000-000000000007', NULL, 'Tennis', 7,
   '{"serve":8,"forehand":8,"backhand":6,"volley":6,"consistency":7}', 4, 5, '', 45),
  ('00000000-0000-0000-0000-000000000006', NULL, '00000000-0000-0000-0000-000000000007', NULL, 'Tennis', 8,
   '{"serve":9,"return":8,"forehand":9,"backhand":8,"topspin":9,"movement":8,"mental":9}', 5, 5,
   'Beat me 6-3 6-4. Huge topspin forehand and stays calm on big points.', 8),
  ('00000000-0000-0000-0000-000000000008', NULL, '00000000-0000-0000-0000-000000000007', NULL, 'Tennis', 8,
   '{"serve":9,"forehand":9,"backhand":7,"volley":7,"overhead":8,"tactics":8}', 5, 5,
   'My doubles partner — best serve I''ve played with at club level.', 20),
  -- Priya Nair · Tennis → Silver (3 at 6+, only 1 at 7+)
  ('00000000-0000-0000-0000-000000000007', NULL, '00000000-0000-0000-0000-000000000008', NULL, 'Tennis', 6,
   '{"serve":5,"return":6,"forehand":6,"backhand":7,"volley":7,"slice":7,"consistency":7,"movement":6}', 5, 5,
   'Super consistent, loves to grind. Two-handed backhand is her best shot.', 15),
  ('00000000-0000-0000-0000-000000000002', NULL, '00000000-0000-0000-0000-000000000008', NULL, 'Tennis', 6,
   '{"forehand":6,"backhand":6,"volley":6,"consistency":7}', 5, 5, 'Long rallies every time. Fun match!', 40),
  ('00000000-0000-0000-0000-000000000006', NULL, '00000000-0000-0000-0000-000000000008', NULL, 'Tennis', 7,
   '{"serve":6,"return":7,"backhand":7,"volley":7,"tactics":7,"mental":7}', 4, 5, '', 60),
  -- Sara Ahmed · Tennis → no badge yet (only 2 ratings)
  ('00000000-0000-0000-0000-000000000007', NULL, '00000000-0000-0000-0000-000000000002', NULL, 'Tennis', 5,
   '{"serve":5,"forehand":6,"backhand":5,"volley":5,"movement":6}', 5, 4, 'Moves really well — serve will come with practice.', 25),
  ('00000000-0000-0000-0000-000000000008', NULL, '00000000-0000-0000-0000-000000000002', NULL, 'Tennis', 6,
   '{"forehand":6,"backhand":5,"consistency":6}', 5, 5, '', 33),
  -- Zara Siddiqui · Badminton → Diamond (3 of 4 at 9+)
  ('00000000-0000-0000-0000-000000000002', NULL, '00000000-0000-0000-0000-000000000006', NULL, 'Badminton', 9,
   '{"serve":9,"clear":8,"smash":10,"drop":9,"net":9,"defence":8,"footwork":9,"deception":9}', 5, 5,
   'Smash is unreal and her net play is just as good. Easily the best player in our club.', 10),
  ('00000000-0000-0000-0000-000000000001', NULL, '00000000-0000-0000-0000-000000000006', NULL, 'Badminton', 9,
   '{"smash":9,"drop":9,"net":9,"footwork":9,"stamina":8}', 5, 5, '', 22),
  ('00000000-0000-0000-0000-000000000005', NULL, '00000000-0000-0000-0000-000000000006', NULL, 'Badminton', 8,
   '{"serve":8,"smash":9,"net":8,"defence":8,"tactics":9}', 4, 5, 'Reads the game two shots ahead.', 50),
  ('00000000-0000-0000-0000-000000000003', NULL, '00000000-0000-0000-0000-000000000006', NULL, 'Badminton', 9,
   '{"smash":10,"clear":9,"footwork":9,"deception":9}', 5, 5, 'Provincial level, no doubt.', 70),
  -- Ali Hassan · Football → Gold (3 at 7+)
  ('00000000-0000-0000-0000-000000000005', NULL, '00000000-0000-0000-0000-000000000001', NULL, 'Football', 7,
   '{"passing":8,"first_touch":7,"dribbling":7,"finishing":7,"vision":8,"stamina":7,"positioning":7}', 5, 5,
   'Runs our midfield. Always finds the pass.', 9),
  ('00000000-0000-0000-0000-000000000003', NULL, '00000000-0000-0000-0000-000000000001', NULL, 'Football', 7,
   '{"passing":7,"finishing":8,"pace":6,"strength":7}', 5, 4, '', 35),
  ('00000000-0000-0000-0000-000000000007', NULL, '00000000-0000-0000-0000-000000000001', NULL, 'Football', 8,
   '{"passing":8,"first_touch":8,"vision":9,"tackling":6}', 5, 5, 'Played against him in a 7-a-side — class on the ball.', 18),
  -- Usman Tariq · Football → no badge yet
  ('00000000-0000-0000-0000-000000000001', NULL, '00000000-0000-0000-0000-000000000005', NULL, 'Football', 6,
   '{"passing":6,"tackling":7,"stamina":8,"marking":6}', 5, 5, 'Never stops running. Great engine in midfield.', 14),
  ('00000000-0000-0000-0000-000000000003', NULL, '00000000-0000-0000-0000-000000000005', NULL, 'Football', 5,
   '{"passing":5,"tackling":6,"stamina":7}', 4, 4, '', 41),
  -- Bilal Khan · Cricket → Gold (4 at 7+, only 2 at 8+)
  ('00000000-0000-0000-0000-000000000001', NULL, '00000000-0000-0000-0000-000000000003', NULL, 'Cricket', 8,
   '{"bat_technique":8,"shot_range":8,"power":7,"running":7,"catching":8,"awareness":9,"temperament":8}', 5, 5,
   'Proper captain. Reads the game better than anyone in the league.', 11),
  ('00000000-0000-0000-0000-000000000005', NULL, '00000000-0000-0000-0000-000000000003', NULL, 'Cricket', 7,
   '{"bat_technique":8,"spin":6,"catching":7,"temperament":8}', 5, 5, '', 28),
  ('00000000-0000-0000-0000-000000000006', NULL, '00000000-0000-0000-0000-000000000003', NULL, 'Cricket', 8,
   '{"bat_technique":8,"shot_range":8,"accuracy":7}', 5, 4, 'Scored a quick fifty against us — lovely cover drive.', 55),
  ('00000000-0000-0000-0000-000000000002', NULL, '00000000-0000-0000-0000-000000000003', NULL, 'Cricket', 7,
   '{"bat_technique":7,"ground":7,"throwing":8}', 5, 5, '', 80),
  -- Scarborough Lions (team) → Silver: rated by High Park FC, Liberty Village United, Etobicoke Rangers
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', NULL, '30000000-0000-0000-0000-000000000005', 'Football', 7,
   '{"attack":7,"defence":6,"possession":7,"pressing":8,"fitness":8,"teamwork":7}', 5, 5,
   'Press high and never let you settle. Tough 90 minutes.', 13),
  ('00000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000004', NULL, '30000000-0000-0000-0000-000000000005', 'Football', 7,
   '{"attack":8,"defence":6,"set_pieces":7,"goalkeeping":5}', 4, 5, 'Dangerous going forward but need a proper keeper.', 26),
  ('00000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000006', NULL, '30000000-0000-0000-0000-000000000005', 'Football', 6,
   '{"attack":6,"defence":6,"fitness":7,"teamwork":6}', 5, 4, '', 47),
  -- High Park FC (team) → Bronze
  ('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', NULL, '30000000-0000-0000-0000-000000000001', 'Football', 6,
   '{"possession":7,"defence":5,"teamwork":7}', 5, 5, 'Nice passing side, friendly bunch.', 13),
  ('00000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000007', NULL, '30000000-0000-0000-0000-000000000001', 'Football', 5,
   '{"attack":5,"defence":5,"fitness":5}', 5, 5, '', 31),
  ('00000000-0000-0000-0000-000000000007', NULL, NULL, '30000000-0000-0000-0000-000000000001', 'Football', 6,
   '{"possession":6,"teamwork":7}', 5, 5, 'Joined them for a Sunday game — well organised.', 19),
  -- Daniel & Priya (doubles pair) → Gold
  ('00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000008', NULL, '30000000-0000-0000-0000-000000000009', 'Tennis', 7,
   '{"serve_return":8,"net":7,"coverage":7,"positioning":7,"communication":8}', 5, 5, 'Big serve + steady partner = very hard to break.', 16),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010', NULL, '30000000-0000-0000-0000-000000000009', 'Tennis', 8,
   '{"serve_return":8,"net":8,"consistency":7}', 5, 5, '', 24),
  ('00000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000011', NULL, '30000000-0000-0000-0000-000000000009', 'Tennis', 7,
   '{"net":7,"coverage":7,"positioning":8}', 5, 5, '', 38)
) AS v(rater, rteam, tplayer, tteam, sport, overall, skills, sm, rel, review, days)
WHERE EXISTS (SELECT 1 FROM profiles WHERE id = v.rater::uuid)
  AND (v.tplayer IS NULL OR EXISTS (SELECT 1 FROM profiles WHERE id = v.tplayer::uuid))
  AND (v.tteam   IS NULL OR EXISTS (SELECT 1 FROM teams    WHERE id = v.tteam::uuid))
  AND (v.rteam   IS NULL OR EXISTS (SELECT 1 FROM teams    WHERE id = v.rteam::uuid))
ON CONFLICT DO NOTHING;

COMMIT;
