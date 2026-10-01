-- ============================================================
-- MatchDay — Match history + automatic win/loss stats
--
--  Every recorded result now counts towards the players' records:
--    • challenges (player vs player; team vs team → every team member)
--    • tournament / league games (players, or every member of a team entry)
--    • pickup "match" events and Organize Match games: the player who
--      entered the score gets their result; in a 1-v-1 the other player
--      gets the opposite; in bigger games the others get "played" (the
--      app doesn't know who was on which side)
--
--  • fn_match_history(user) — one row per game: when, sport, opponent,
--    score, won / lost / draw / played. Worked out from the results
--    every time, so a corrected score corrects the record (no double
--    counting).
--  • match_history(user, limit) / verified_record(user) RPCs for the app,
--    respecting profile visibility (Friends Only stays friends only).
--  • profiles.stats (profile header "Matches / Wins", Hood cards, area
--    ranking) = manual stats (Profile → Record Stats) + verified games,
--    kept up to date by triggers whenever a result or manual stat changes.
--    Demo players keep their sample numbers.
--  • tournament_matches.played_at — when a game's result was entered.
--
-- Run in Supabase SQL Editor AFTER patch_matchday.sql. Safe to re-run.
-- ============================================================

BEGIN;

-- ── 1. When was a tournament game played? ───────────────────
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS played_at timestamptz;

CREATE OR REPLACE FUNCTION fn_tournament_matches_played_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done'
                              OR NEW.winner_id IS DISTINCT FROM OLD.winner_id
                              OR NEW.is_draw IS DISTINCT FROM OLD.is_draw
                              OR NEW.score IS DISTINCT FROM OLD.score) THEN
    NEW.played_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tournament_matches_played_at ON tournament_matches;
CREATE TRIGGER trg_tournament_matches_played_at
  BEFORE UPDATE ON tournament_matches
  FOR EACH ROW EXECUTE FUNCTION fn_tournament_matches_played_at();

UPDATE tournament_matches m SET played_at = COALESCE(t.starts_on::timestamptz, t.created_at)
FROM tournaments t
WHERE t.id = m.tournament_id AND m.status = 'done' AND m.played_at IS NULL;

-- ── 2. Every game a player took part in ─────────────────────
-- outcome: 'won' | 'lost' | 'draw' | 'played' (in it, result side unknown)
-- opp_kind: 'player' | 'team' | 'group' (a bigger pickup game)
CREATE OR REPLACE FUNCTION fn_match_history(p_user uuid)
RETURNS TABLE (
  source text, ref_id uuid, event_id uuid, event_name text, sport text, played_at timestamptz,
  my_side_name text, opp_kind text, opp_id uuid, opp_name text, opp_user_id uuid,
  score text, outcome text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Challenges
  SELECT 'challenge', c.id, NULL::uuid, NULL::text, c.sport, COALESCE(c.updated_at, c.created_at),
         s.my_name, c.kind, s.opp_id, s.opp_name, s.opp_user,
         c.score,
         CASE WHEN c.is_draw THEN 'draw' WHEN c.winner_id = s.my_id THEN 'won' ELSE 'lost' END
  FROM challenges c
  CROSS JOIN LATERAL (
    SELECT c.challenger_id AS my_id, c.challenger_name AS my_name,
           c.opponent_id AS opp_id, c.opponent_name AS opp_name, c.opponent_user_id AS opp_user
    WHERE (c.kind = 'player' AND c.challenger_id = p_user)
       OR (c.kind = 'team' AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = c.challenger_id AND tm.user_id = p_user))
    UNION ALL
    SELECT c.opponent_id, c.opponent_name, c.challenger_id, c.challenger_name, c.challenger_user_id
    WHERE (c.kind = 'player' AND c.opponent_id = p_user)
       OR (c.kind = 'team' AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = c.opponent_id AND tm.user_id = p_user))
  ) s
  WHERE c.status = 'completed'

  UNION ALL
  -- Tournament / league games (byes have no opponent and are skipped)
  SELECT 'event_game', m.id, t.id, t.name, t.sport, COALESCE(m.played_at, t.starts_on::timestamptz, t.created_at),
         s.my_name, CASE WHEN t.entrant_type = 'team' THEN 'team' ELSE 'player' END, s.opp_id, s.opp_name,
         CASE WHEN t.entrant_type = 'team' THEN (SELECT tm.owner_id FROM teams tm WHERE tm.id = s.opp_id) ELSE s.opp_id END,
         m.score,
         CASE WHEN m.is_draw THEN 'draw' WHEN m.winner_id = s.my_id THEN 'won' ELSE 'lost' END
  FROM tournament_matches m
  JOIN tournaments t ON t.id = m.tournament_id
  CROSS JOIN LATERAL (
    SELECT m.a_id AS my_id, m.a_name AS my_name, m.b_id AS opp_id, m.b_name AS opp_name
    WHERE m.a_id = p_user OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = m.a_id AND tm.user_id = p_user)
    UNION ALL
    SELECT m.b_id, m.b_name, m.a_id, m.a_name
    WHERE m.b_id = p_user OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = m.b_id AND tm.user_id = p_user)
  ) s
  WHERE m.status = 'done' AND m.a_id IS NOT NULL AND m.b_id IS NOT NULL

  UNION ALL
  -- Pickup "match" events
  SELECT 'event_match', t.id, t.id, t.name, t.sport, COALESCE(t.result_at, t.starts_on::timestamptz, t.created_at),
         NULL, CASE WHEN g.n = 2 THEN 'player' ELSE 'group' END,
         o.id, COALESCE(o.name, t.name), o.id,
         t.result_score,
         CASE WHEN t.result_outcome IS NULL THEN 'played'
              WHEN t.result_outcome = 'draw' THEN 'draw'
              WHEN t.result_by = p_user THEN t.result_outcome
              WHEN g.n = 2 AND g.recorder_played THEN CASE t.result_outcome WHEN 'won' THEN 'lost' ELSE 'won' END
              ELSE 'played' END
  FROM tournaments t
  JOIN tournament_registrations r ON r.tournament_id = t.id AND r.user_id = p_user
  CROSS JOIN LATERAL (
    SELECT count(*) AS n, bool_or(r2.user_id = t.result_by) AS recorder_played
    FROM tournament_registrations r2 WHERE r2.tournament_id = t.id
  ) g
  LEFT JOIN LATERAL (
    SELECT pr.id, pr.name FROM tournament_registrations r3 JOIN profiles pr ON pr.id = r3.user_id
    WHERE r3.tournament_id = t.id AND r3.user_id <> p_user AND g.n = 2 LIMIT 1
  ) o ON true
  WHERE t.type = 'match' AND t.status = 'completed' AND t.result_score IS NOT NULL

  UNION ALL
  -- Organize Match games
  SELECT 'pickup', mt.id, NULL::uuid, mt.title, mt.sport, COALESCE(mt.result_at, mt.starts_on::timestamptz, mt.created_at),
         NULL, CASE WHEN g.n = 2 THEN 'player' ELSE 'group' END,
         o.id, COALESCE(o.name, mt.title), o.id,
         mt.result_score,
         CASE WHEN mt.result_outcome IS NULL THEN 'played'
              WHEN mt.result_outcome = 'draw' THEN 'draw'
              WHEN mt.result_by = p_user THEN mt.result_outcome
              WHEN g.n = 2 AND g.recorder_played THEN CASE mt.result_outcome WHEN 'won' THEN 'lost' ELSE 'won' END
              ELSE 'played' END
  FROM matches mt
  JOIN match_players mp ON mp.match_id = mt.id AND mp.player_id = p_user
  CROSS JOIN LATERAL (
    SELECT count(*) AS n, bool_or(mp2.player_id = mt.result_by) AS recorder_played
    FROM match_players mp2 WHERE mp2.match_id = mt.id
  ) g
  LEFT JOIN LATERAL (
    SELECT pr.id, pr.name FROM match_players mp3 JOIN profiles pr ON pr.id = mp3.player_id
    WHERE mp3.match_id = mt.id AND mp3.player_id <> p_user AND g.n = 2 LIMIT 1
  ) o ON true
  WHERE mt.status = 'completed' AND mt.result_score IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION fn_match_history(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. App-facing RPCs (respect profile visibility) ─────────
-- Same rule as the profiles_select policy
CREATE OR REPLACE FUNCTION fn_can_view_profile(p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_target = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = p_target AND (p.privacy = 'public' OR COALESCE(p.is_demo, false)))
      OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = p_target AND f.following_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION match_history(p_user uuid, p_limit int DEFAULT 200)
RETURNS TABLE (
  source text, ref_id uuid, event_id uuid, event_name text, sport text, played_at timestamptz,
  my_side_name text, opp_kind text, opp_id uuid, opp_name text, opp_user_id uuid,
  score text, outcome text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.* FROM fn_match_history(p_user) h
  WHERE fn_can_view_profile(p_user)
  ORDER BY h.played_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
$$;
GRANT EXECUTE ON FUNCTION match_history(uuid, int) TO anon, authenticated;

-- Verified record per sport (counts only games with a known result for this player)
CREATE OR REPLACE FUNCTION verified_record(p_user uuid)
RETURNS TABLE (sport text, played int, wins int, losses int, draws int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.sport,
         count(*)::int,
         count(*) FILTER (WHERE h.outcome = 'won')::int,
         count(*) FILTER (WHERE h.outcome = 'lost')::int,
         count(*) FILTER (WHERE h.outcome = 'draw')::int
  FROM fn_match_history(p_user) h
  WHERE fn_can_view_profile(p_user)
  GROUP BY h.sport
  ORDER BY count(*) DESC, h.sport
$$;
GRANT EXECUTE ON FUNCTION verified_record(uuid) TO anon, authenticated;

-- ── 4. Profile headline stats = manual + verified ───────────
CREATE OR REPLACE FUNCTION fn_refresh_profile_stats(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  man_m int; man_w int; ver_m int; ver_w int;
BEGIN
  IF p_user IS NULL OR EXISTS (SELECT 1 FROM profiles WHERE id = p_user AND COALESCE(is_demo, false)) THEN RETURN; END IF;
  SELECT COALESCE(sum(matches), 0), COALESCE(sum(wins), 0) INTO man_m, man_w FROM player_stats WHERE profile_id = p_user;
  SELECT count(*), count(*) FILTER (WHERE outcome = 'won') INTO ver_m, ver_w FROM fn_match_history(p_user);
  UPDATE profiles
  SET stats = COALESCE(stats, '{}'::jsonb)
              || jsonb_build_object('matches', man_m + ver_m, 'wins', man_w + ver_w)
              || CASE WHEN stats ? 'rank' THEN '{}'::jsonb ELSE '{"rank":"Bronze"}'::jsonb END
  WHERE id = p_user;
END;
$$;

-- People on a side: the player, or every member of a team
CREATE OR REPLACE FUNCTION fn_side_users(p_side uuid)
RETURNS TABLE (user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_side WHERE EXISTS (SELECT 1 FROM profiles WHERE id = p_side)
  UNION
  SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_side
$$;

CREATE OR REPLACE FUNCTION fn_stats_after_challenge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  IF NEW.status = 'completed' OR OLD.status = 'completed' THEN
    FOR u IN SELECT user_id FROM fn_side_users(NEW.challenger_id) UNION SELECT user_id FROM fn_side_users(NEW.opponent_id) LOOP
      PERFORM fn_refresh_profile_stats(u);
    END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stats_after_challenge ON challenges;
CREATE TRIGGER trg_stats_after_challenge
  AFTER UPDATE ON challenges FOR EACH ROW EXECUTE FUNCTION fn_stats_after_challenge();

CREATE OR REPLACE FUNCTION fn_stats_after_game()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  IF NEW.status = 'done' OR OLD.status = 'done' THEN
    FOR u IN SELECT user_id FROM fn_side_users(NEW.a_id) UNION SELECT user_id FROM fn_side_users(NEW.b_id) LOOP
      PERFORM fn_refresh_profile_stats(u);
    END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stats_after_game ON tournament_matches;
CREATE TRIGGER trg_stats_after_game
  AFTER UPDATE ON tournament_matches FOR EACH ROW EXECUTE FUNCTION fn_stats_after_game();

CREATE OR REPLACE FUNCTION fn_stats_after_event_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  IF NEW.type = 'match' AND (NEW.result_score IS DISTINCT FROM OLD.result_score
                             OR NEW.result_outcome IS DISTINCT FROM OLD.result_outcome
                             OR NEW.result_by IS DISTINCT FROM OLD.result_by
                             OR NEW.status IS DISTINCT FROM OLD.status) THEN
    FOR u IN SELECT r.user_id FROM tournament_registrations r WHERE r.tournament_id = NEW.id LOOP
      PERFORM fn_refresh_profile_stats(u);
    END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stats_after_event_result ON tournaments;
CREATE TRIGGER trg_stats_after_event_result
  AFTER UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION fn_stats_after_event_result();

CREATE OR REPLACE FUNCTION fn_stats_after_pickup_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid;
BEGIN
  IF NEW.result_score IS DISTINCT FROM OLD.result_score
     OR NEW.result_outcome IS DISTINCT FROM OLD.result_outcome
     OR NEW.result_by IS DISTINCT FROM OLD.result_by
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    FOR u IN SELECT mp.player_id FROM match_players mp WHERE mp.match_id = NEW.id LOOP
      PERFORM fn_refresh_profile_stats(u);
    END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stats_after_pickup_result ON matches;
CREATE TRIGGER trg_stats_after_pickup_result
  AFTER UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION fn_stats_after_pickup_result();

CREATE OR REPLACE FUNCTION fn_stats_after_manual()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM fn_refresh_profile_stats(CASE WHEN TG_OP = 'DELETE' THEN OLD.profile_id ELSE NEW.profile_id END);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_stats_after_manual ON player_stats;
CREATE TRIGGER trg_stats_after_manual
  AFTER INSERT OR UPDATE OR DELETE ON player_stats FOR EACH ROW EXECUTE FUNCTION fn_stats_after_manual();

-- Bring every real player's headline stats up to date now
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT id FROM profiles WHERE NOT COALESCE(is_demo, false) LOOP
    PERFORM fn_refresh_profile_stats(u);
  END LOOP;
END $$;

COMMIT;
