  -- ============================================================
  -- MatchDay — Popups for ratings
  --
  --  submit_rating() is unchanged except:
  --   • changing a rating you already gave (new score or review) now also
  --     notifies the rated player ("X updated their rating"); before, only
  --     first-time ratings did
  --   • its notifications now carry what the in-app popup needs:
  --    new_rating → rating_id, rate_kind, rate_id, rate_name, sport
  --                 (the popup shows the exact rating the other player gave)
  --    new_badge  → badge, rate_kind, rate_id, rate_name, sport
  --  The old keys (rating_player_id / team_id) stay, so notification taps
  --  keep working. Rating-request popups need no database change.
  --
  -- Run once in Supabase SQL Editor (after patch_ratings.sql). Safe to re-run.
  -- ============================================================

  BEGIN;

  -- Same as lib/db/patch_ratings.sql §5, with richer notification data
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
    old_overall  int;
    old_review   text;
    changed      boolean := false;
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

    SELECT overall, review INTO old_overall, old_review FROM ratings
    WHERE COALESCE(rater_team, rater_user_id) = COALESCE(p_as_team, me)
      AND COALESCE(target_player, target_team) = p_target_id
      AND sport = v_sport;

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

    changed := NOT is_new AND (old_overall IS DISTINCT FROM p_overall
                              OR COALESCE(old_review, '') IS DISTINCT FROM btrim(COALESCE(p_review, '')));

    SELECT s.badge INTO after_badge FROM rating_summary(p_target_kind, p_target_id) s WHERE s.sport = v_sport;
    SELECT tier_rank INTO rank_before FROM fn_rating_tiers() WHERE tier = before_badge;
    SELECT tier_rank INTO rank_after  FROM fn_rating_tiers() WHERE tier = after_badge;

    IF NOT t_demo AND t_user <> me THEN
      IF is_new OR changed THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (t_user, 'new_rating',
                CASE WHEN is_new THEN '⭐ New ' ELSE '⭐ Updated ' END || v_sport || ' rating',
                r_name || CASE WHEN is_new THEN ' rated ' ELSE ' updated their rating of ' END
                      || CASE WHEN p_target_kind = 'team' THEN t_name ELSE 'you' END
                      || CASE WHEN is_new THEN ' ' ELSE ' to ' END || p_overall || '/10'
                      || CASE WHEN btrim(COALESCE(p_review, '')) <> '' THEN ' and left a review.' ELSE '.' END,
                CASE WHEN p_target_kind = 'team' THEN jsonb_build_object('team_id', p_target_id)
                    ELSE jsonb_build_object('rating_player_id', p_target_id) END
                || jsonb_build_object('rating_id', row_id, 'rate_kind', p_target_kind, 'rate_id', p_target_id,
                                      'rate_name', t_name, 'sport', v_sport, 'updated', NOT is_new));
      END IF;
      IF COALESCE(rank_after, 0) > COALESCE(rank_before, 0) THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (t_user, 'new_badge', '🏅 ' || initcap(after_badge) || ' badge earned',
                CASE WHEN p_target_kind = 'team' THEN t_name || ' is' ELSE 'You''re' END
                  || ' now rated ' || initcap(after_badge) || ' in ' || v_sport || '.',
                CASE WHEN p_target_kind = 'team' THEN jsonb_build_object('team_id', p_target_id)
                    ELSE jsonb_build_object('rating_player_id', p_target_id) END
                || jsonb_build_object('badge', after_badge, 'rate_kind', p_target_kind, 'rate_id', p_target_id,
                                      'rate_name', t_name, 'sport', v_sport));
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

  COMMIT;
