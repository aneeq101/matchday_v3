-- ============================================================
-- MatchDay — Realistic team sizes + nearby event alerts
--
--  1. Team sizes: every team has a format, and its squad size
--     (max_members) must fit that format. Mirrors TEAM_FORMATS in
--     lib/sportRules.ts — keep the two in step.
--       Tennis / Badminton   Doubles pair   exactly 2
--       Football   5-a-side 5–10 · 7-a-side 7–14 · 11-a-side 11–25
--       Cricket    8-a-side 8–12 · 11-a-side 11–16
--       Basketball 3x3 3–4 · 5-on-5 5–15
--       Baseball   9 players 9–20
--       Hockey     6 on ice 6–22
--     Existing teams get a format that fits them. Only the demo
--     badminton "pair" with 3 members is fixed (demo Sara removed).
--     The squad size can't be set below the current member count.
--
--  2. Nearby event alerts: when a tournament, league or paid match
--     is created, players who play that sport and live within their
--     alert radius get a notification (which also sends a phone push
--     via the existing notifications trigger). Max 3 alerts per player
--     per 24 hours. Players can turn it off / pick a radius
--     (profiles.event_alerts, profiles.event_alert_radius_km).
--     Event coordinates come from the venue picked in the app, or from
--     a venue whose name matches the location text, or (for the alert
--     only) the organiser's own location.
--
-- Run once in Supabase SQL Editor. Safe to re-run. All-or-nothing.
-- ============================================================

BEGIN;

-- ── 1. Team formats ─────────────────────────────────────────
ALTER TABLE teams ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION fn_team_formats()
RETURNS TABLE (sport text, format text, on_field int, min_size int, max_size int, def_size int)
LANGUAGE sql IMMUTABLE AS $$
  VALUES
    ('Tennis',     'Doubles',   2,  2,  2,  2),
    ('Badminton',  'Doubles',   2,  2,  2,  2),
    ('Football',   '5-a-side',  5,  5, 10,  8),
    ('Football',   '7-a-side',  7,  7, 14, 10),
    ('Football',   '11-a-side', 11, 11, 25, 18),
    ('Cricket',    '8-a-side',  8,  8, 12, 10),
    ('Cricket',    '11-a-side', 11, 11, 16, 14),
    ('Basketball', '3x3',       3,  3,  4,  4),
    ('Basketball', '5-on-5',    5,  5, 15, 12),
    ('Baseball',   '9 players', 9,  9, 20, 14),
    ('Hockey',     '6 on ice',  6,  6, 22, 15)
$$;

-- Format for a team saved without one (older app versions): the biggest
-- format whose squad range fits max_members, else the sport's default.
CREATE OR REPLACE FUNCTION fn_team_guess_format(p_sport text, p_max int)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT f.format FROM fn_team_formats() f
      WHERE f.sport = p_sport AND p_max BETWEEN f.min_size AND f.max_size
      ORDER BY f.on_field DESC LIMIT 1),
    (SELECT f.format FROM fn_team_formats() f
      WHERE f.sport = p_sport
      ORDER BY abs(f.def_size - p_max) LIMIT 1)
  )
$$;

-- Demo badminton "pair" had 3 members: keep the captain (Zara) and the real
-- player who joined, drop demo Sara, so it's a proper doubles pair.
DELETE FROM team_members
WHERE team_id = '30000000-0000-0000-0000-000000000002'
  AND user_id = '00000000-0000-0000-0000-000000000002'
  AND (SELECT count(*) FROM team_members WHERE team_id = '30000000-0000-0000-0000-000000000002') > 2;
UPDATE teams SET description = 'Weeknight doubles pair. Bring your own racquet.'
WHERE id = '30000000-0000-0000-0000-000000000002' AND description = 'Weeknight doubles crew. Bring your own racquet.';

-- Demo football teams: formats that match their descriptions
UPDATE teams SET format = '7-a-side'                     WHERE id = '30000000-0000-0000-0000-000000000001' AND format = ''; -- High Park FC
UPDATE teams SET format = '5-a-side', max_members = 10   WHERE id = '30000000-0000-0000-0000-000000000004' AND format = ''; -- Liberty Village United (5-a-side crew)
UPDATE teams SET format = '11-a-side', max_members = 18  WHERE id = '30000000-0000-0000-0000-000000000005' AND format = ''; -- Scarborough Lions
UPDATE teams SET format = '11-a-side', max_members = 18  WHERE id = '30000000-0000-0000-0000-000000000006' AND format = ''; -- Etobicoke Rangers
UPDATE teams SET format = '7-a-side'                     WHERE id = '30000000-0000-0000-0000-000000000007' AND format = ''; -- North York Galaxy

-- Everyone else: guess the format, then pull max_members into its range
-- (never below the current member count — those teams are left as they are).
UPDATE teams t SET format = COALESCE(fn_team_guess_format(t.sport, t.max_members), '')
WHERE t.format = '';
UPDATE teams t
SET max_members = GREATEST(
      (SELECT count(*)::int FROM team_members m WHERE m.team_id = t.id),
      LEAST(GREATEST(t.max_members, f.min_size), f.max_size))
FROM fn_team_formats() f
WHERE f.sport = t.sport AND f.format = t.format
  AND (t.max_members < f.min_size OR t.max_members > f.max_size);

-- Validate on create, and on edit when the size or format changes
CREATE OR REPLACE FUNCTION fn_teams_validate_size()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f   record;
  cnt int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.max_members = OLD.max_members
     AND NEW.format = OLD.format AND NEW.sport = OLD.sport THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.format, '') = '' THEN
    NEW.format := COALESCE(fn_team_guess_format(NEW.sport, NEW.max_members), '');
  END IF;

  SELECT * INTO f FROM fn_team_formats() x WHERE x.sport = NEW.sport AND x.format = NEW.format;
  IF FOUND THEN
    IF NEW.max_members < f.min_size OR NEW.max_members > f.max_size THEN
      RAISE EXCEPTION 'TEAM_SIZE_INVALID: % % teams have % to % players', NEW.sport, NEW.format, f.min_size, f.max_size;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM fn_team_formats() x WHERE x.sport = NEW.sport) THEN
    RAISE EXCEPTION 'TEAM_FORMAT_INVALID';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT count(*) INTO cnt FROM team_members WHERE team_id = NEW.id;
    IF NEW.max_members < cnt THEN RAISE EXCEPTION 'TEAM_TOO_SMALL'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_validate_size ON teams;
CREATE TRIGGER trg_teams_validate_size
  BEFORE INSERT OR UPDATE OF max_members, format, sport ON teams
  FOR EACH ROW EXECUTE FUNCTION fn_teams_validate_size();

-- ── 2. Event coordinates ────────────────────────────────────
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS latitude  double precision;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS geo       geography(Point, 4326);

CREATE OR REPLACE FUNCTION fn_tournaments_sync_geo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v record;
BEGIN
  -- No coordinates from the app: use a venue whose name starts the location text
  IF (NEW.latitude IS NULL OR NEW.longitude IS NULL) AND COALESCE(NEW.location, '') <> '' THEN
    SELECT latitude, longitude INTO v FROM venues
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND name <> ''
      AND NEW.location ILIKE name || '%'
    ORDER BY length(name) DESC LIMIT 1;
    IF FOUND THEN NEW.latitude := v.latitude; NEW.longitude := v.longitude; END IF;
  END IF;
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.geo := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournaments_sync_geo ON tournaments;
CREATE TRIGGER trg_tournaments_sync_geo
  BEFORE INSERT OR UPDATE OF latitude, longitude, location ON tournaments
  FOR EACH ROW EXECUTE FUNCTION fn_tournaments_sync_geo();

-- Fill in coordinates for existing events (fires the trigger above)
UPDATE tournaments SET location = location WHERE geo IS NULL AND COALESCE(location, '') <> '';

-- ── 3. Alert settings ───────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS event_alerts          boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS event_alert_radius_km int     NOT NULL DEFAULT 25;
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_event_alert_radius_chk CHECK (event_alert_radius_km BETWEEN 1 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Alert nearby players when an event is created ────────
CREATE OR REPLACE FUNCTION fn_alert_nearby_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  pt    geography := NEW.geo;
  kind  text;
  extra text := '';
BEGIN
  IF COALESCE(NEW.status, 'active') <> 'active' THEN RETURN NEW; END IF;
  -- Tournaments and leagues always; pickup matches only when they cost money
  IF NEW.type NOT IN ('tournament', 'league', 'match') THEN RETURN NEW; END IF;
  IF NEW.type = 'match' AND COALESCE(NEW.entry_fee, 0) <= 0 THEN RETURN NEW; END IF;

  IF pt IS NULL THEN
    SELECT location INTO pt FROM profiles WHERE id = NEW.organiser_id;
  END IF;
  IF pt IS NULL THEN RETURN NEW; END IF;

  kind := CASE NEW.type WHEN 'league' THEN 'league' WHEN 'match' THEN 'paid match' ELSE 'tournament' END;
  IF COALESCE(NEW.entry_fee, 0) > 0 THEN extra := extra || ' · CAD ' || NEW.entry_fee || ' entry'; END IF;
  IF COALESCE(NEW.prize_pool, 0) > 0 THEN extra := extra || ' · CAD ' || NEW.prize_pool || ' prize'; END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT p.id, 'nearby_event',
         COALESCE(NULLIF(NEW.sport_emoji, ''), '🏆') || ' New ' || NEW.sport || ' ' || kind || ' near you',
         NEW.name || ' · ' || COALESCE(NULLIF(NEW.date_text, ''), 'Date TBD')
           || ' · ' || CASE WHEN d.km < 1 THEN 'under 1' ELSE round(d.km)::text END || ' km away' || extra,
         jsonb_build_object('tournament_id', NEW.id)
  FROM profiles p
  CROSS JOIN LATERAL (SELECT ST_Distance(p.location, pt) / 1000.0 AS km) d
  WHERE p.location IS NOT NULL
    AND p.event_alerts
    AND NOT COALESCE(p.is_demo, false)
    AND p.id IS DISTINCT FROM NEW.organiser_id
    AND COALESCE(p.location_updated_at, now()) > now() - interval '90 days'
    AND ST_DWithin(p.location, pt, p.event_alert_radius_km * 1000.0)
    AND EXISTS (SELECT 1 FROM profile_sports ps WHERE ps.profile_id = p.id AND ps.sport = NEW.sport)
    AND (SELECT count(*) FROM notifications n
         WHERE n.user_id = p.id AND n.type = 'nearby_event' AND n.created_at > now() - interval '24 hours') < 3
  ORDER BY d.km
  LIMIT 500;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- An alert problem must never stop the event from being created
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_nearby_event ON tournaments;
CREATE TRIGGER trg_alert_nearby_event
  AFTER INSERT ON tournaments
  FOR EACH ROW EXECUTE FUNCTION fn_alert_nearby_event();

COMMIT;
