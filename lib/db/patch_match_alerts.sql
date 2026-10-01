-- ============================================================
-- MatchDay — Nearby alerts for prize money Organize Match games
--
--  Until now only Play to Earn events (tournaments table) alerted nearby
--  players. Organize Match games (matches table) had no location point and
--  no alert trigger, so a new prize match in My Turf reached nobody.
--
--  • matches.latitude / longitude / geo (+ sync trigger, same rules as
--    tournaments: the app sends the venue coord from the location picker,
--    else a venue whose name starts the location text is used).
--  • trg_alert_nearby_match (AFTER INSERT on matches): prize matches that
--    are upcoming and not already in the past → 'nearby_event'
--    notifications with data { match_id } → in-app popup + phone push.
--    Same recipients as event alerts: not demo, not the organiser, event
--    alerts on, play that sport, location saved in the last 90 days within
--    their alert radius, max 3 alerts per 24 h (shared with event alerts),
--    nearest 500. Falls back to the organiser's location for the point.
--
-- Run once in Supabase SQL Editor. Safe to re-run. All-or-nothing.
-- Needs patch_event_category.sql (matches.category / entry_fee / prize_pool).
-- ============================================================

BEGIN;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS latitude  double precision;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS geo       geography(Point, 4326);

-- fn_tournaments_sync_geo only uses latitude / longitude / location / geo,
-- which matches now has too
DROP TRIGGER IF EXISTS trg_matches_sync_geo ON matches;
CREATE TRIGGER trg_matches_sync_geo
  BEFORE INSERT OR UPDATE OF latitude, longitude, location ON matches
  FOR EACH ROW EXECUTE FUNCTION fn_tournaments_sync_geo();

-- Existing matches: pick up a point from the venue name where possible
UPDATE matches SET location = location WHERE geo IS NULL AND COALESCE(location, '') <> '';

CREATE OR REPLACE FUNCTION fn_alert_nearby_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  pt    geography := NEW.geo;
  extra text := '';
BEGIN
  IF COALESCE(NEW.status, 'upcoming') <> 'upcoming' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.category, 'friendly') <> 'prize' THEN RETURN NEW; END IF;
  IF NEW.starts_on IS NOT NULL AND NEW.starts_on < current_date THEN RETURN NEW; END IF;

  IF pt IS NULL THEN
    SELECT location INTO pt FROM profiles WHERE id = NEW.creator_id;
  END IF;
  IF pt IS NULL THEN RETURN NEW; END IF;

  IF COALESCE(NEW.prize_pool, 0) > 0 THEN extra := extra || ' · CAD ' || NEW.prize_pool || ' prize'; END IF;
  IF COALESCE(NEW.entry_fee, 0) > 0 THEN extra := extra || ' · CAD ' || NEW.entry_fee || ' entry'; END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.id, 'nearby_event',
         COALESCE(NULLIF(NEW.sport_emoji, ''), '🏆') || ' New ' || NEW.sport || ' prize match near you',
         NEW.title || ' · ' || COALESCE(NULLIF(NEW.match_date, ''), 'Date TBD')
           || ' · ' || CASE WHEN d.km < 1 THEN 'under 1' ELSE round(d.km)::text END || ' km away' || extra,
         jsonb_build_object('match_id', NEW.id)
  FROM profiles p
  CROSS JOIN LATERAL (SELECT ST_Distance(p.location, pt) / 1000.0 AS km) d
  WHERE p.location IS NOT NULL
    AND p.event_alerts
    AND NOT COALESCE(p.is_demo, false)
    AND p.id IS DISTINCT FROM NEW.creator_id
    AND COALESCE(p.location_updated_at, now()) > now() - interval '90 days'
    AND ST_DWithin(p.location, pt, p.event_alert_radius_km * 1000.0)
    AND EXISTS (SELECT 1 FROM profile_sports ps WHERE ps.profile_id = p.id AND ps.sport = NEW.sport)
    AND (SELECT count(*) FROM notifications n
         WHERE n.user_id = p.id AND n.type = 'nearby_event' AND n.created_at > now() - interval '24 hours') < 3
  ORDER BY d.km
  LIMIT 500;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- An alert problem must never stop the match from being created
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_nearby_match ON matches;
CREATE TRIGGER trg_alert_nearby_match
  AFTER INSERT ON matches
  FOR EACH ROW EXECUTE FUNCTION fn_alert_nearby_match();

COMMIT;
