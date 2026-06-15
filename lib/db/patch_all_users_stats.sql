-- ============================================================
-- Patch: insert dummy player_stats for every profile that
--        doesn't have any stats yet (covers real sign-up users)
-- Run once in Supabase SQL Editor AFTER patch_player_stats.sql
-- ============================================================

DO $$
DECLARE
  rec       RECORD;
  v_matches int;
  v_wins    int;
  v_draws   int;
  v_losses  int;
  -- second sport picks per seed value
  sports_a  text[] := ARRAY['Cricket','Tennis','Basketball','Badminton','Baseball','Cricket'];
BEGIN
  FOR rec IN
    SELECT id
    FROM   profiles
    WHERE  id NOT IN (SELECT DISTINCT profile_id FROM player_stats)
  LOOP

    -- ── Sport 1: Football ───────────────────────────────────
    v_matches := (floor(random() * 28 + 8))::int;
    v_wins    := (floor(random() * (v_matches * 0.75)))::int;
    v_draws   := (floor(random() * ((v_matches - v_wins) * 0.30)))::int;
    v_losses  := v_matches - v_wins - v_draws;

    INSERT INTO player_stats
      (profile_id, sport, matches, wins, losses, draws, sport_stats)
    VALUES (
      rec.id, 'Football', v_matches, v_wins, v_losses, v_draws,
      jsonb_build_object(
        'goals',        (floor(random() * 18 + 1))::int,
        'assists',      (floor(random() * 12 + 1))::int,
        'clean_sheets', 0,
        'yellow_cards', (floor(random() * 5))::int,
        'red_cards',    (floor(random() * 2))::int
      )
    )
    ON CONFLICT (profile_id, sport) DO NOTHING;

    -- ── Sport 2: varied ────────────────────────────────────
    v_matches := (floor(random() * 20 + 4))::int;
    v_wins    := (floor(random() * (v_matches * 0.70)))::int;
    v_draws   := 0;
    v_losses  := v_matches - v_wins;

    INSERT INTO player_stats
      (profile_id, sport, matches, wins, losses, draws, sport_stats)
    VALUES (
      rec.id, 'Cricket', v_matches, v_wins, v_losses, v_draws,
      jsonb_build_object(
        'runs',         (floor(random() * 900 + 120))::int,
        'wickets',      (floor(random() * 35 + 3))::int,
        'batting_avg',  round((random() * 32 + 14)::numeric, 1)::text,
        'bowling_avg',  round((random() * 28 + 11)::numeric, 1)::text,
        'centuries',    (floor(random() * 4))::int,
        'fifties',      (floor(random() * 9))::int
      )
    )
    ON CONFLICT (profile_id, sport) DO NOTHING;

  END LOOP;
END $$;
