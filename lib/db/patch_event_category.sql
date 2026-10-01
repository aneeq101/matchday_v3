-- ============================================================
-- MatchDay — Friendly vs Prize money events, matches and bookings
--
--  Same choice on Play to Earn events (tournaments), Organize Match
--  (matches) and venue bookings (bookings): category + entry_fee + prize_pool.
--
--  tournaments.category:
--    'friendly' — just for fun: no entry fee, no prize pool
--    'prize'    — prize money: a prize pool (and optionally an entry fee)
--  • Existing events: anything with an entry fee or prize pool → 'prize',
--    everything else → 'friendly'.
--  • Enforced on save: a prize event needs a prize pool or an entry fee;
--    a friendly event can't be given money later. A new event saved with
--    money but no category (older app versions) becomes 'prize'.
--  • Nearby event alerts (fn_alert_nearby_event): tournaments and leagues
--    always; single matches only when they're prize matches. The alert
--    says "friendly tournament" / "prize match" etc.
--
-- Run once in Supabase SQL Editor. Safe to re-run. All-or-nothing.
-- ============================================================

BEGIN;

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'friendly';
DO $$ BEGIN
  ALTER TABLE tournaments ADD CONSTRAINT tournaments_category_chk CHECK (category IN ('friendly', 'prize'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE tournaments SET category = 'prize'
WHERE category = 'friendly' AND (COALESCE(entry_fee, 0) > 0 OR COALESCE(prize_pool, 0) > 0);

-- Organize Match games and venue bookings get the same three columns
ALTER TABLE matches  ADD COLUMN IF NOT EXISTS category   text NOT NULL DEFAULT 'friendly';
ALTER TABLE matches  ADD COLUMN IF NOT EXISTS entry_fee  int  NOT NULL DEFAULT 0;
ALTER TABLE matches  ADD COLUMN IF NOT EXISTS prize_pool int  NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS category   text NOT NULL DEFAULT 'friendly';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS entry_fee  int  NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS prize_pool int  NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE matches ADD CONSTRAINT matches_category_chk CHECK (category IN ('friendly', 'prize'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_category_chk CHECK (category IN ('friendly', 'prize'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION fn_tournaments_category()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Older app versions don't send a category: infer it from the money
  IF TG_OP = 'INSERT' AND NEW.category = 'friendly'
     AND (COALESCE(NEW.entry_fee, 0) > 0 OR COALESCE(NEW.prize_pool, 0) > 0) THEN
    NEW.category := 'prize';
  END IF;

  IF NEW.category = 'friendly' AND (COALESCE(NEW.entry_fee, 0) > 0 OR COALESCE(NEW.prize_pool, 0) > 0) THEN
    RAISE EXCEPTION 'FRIENDLY_NO_MONEY';
  END IF;
  IF NEW.category = 'prize' AND COALESCE(NEW.entry_fee, 0) <= 0 AND COALESCE(NEW.prize_pool, 0) <= 0 THEN
    RAISE EXCEPTION 'PRIZE_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_tournaments_category ON tournaments;
CREATE TRIGGER trg_tournaments_category
  BEFORE INSERT OR UPDATE OF category, entry_fee, prize_pool ON tournaments
  FOR EACH ROW EXECUTE FUNCTION fn_tournaments_category();

-- Same rules for matches and bookings (fn_tournaments_category only uses
-- category / entry_fee / prize_pool, which all three tables now have)
DROP TRIGGER IF EXISTS trg_matches_category ON matches;
CREATE TRIGGER trg_matches_category
  BEFORE INSERT OR UPDATE OF category, entry_fee, prize_pool ON matches
  FOR EACH ROW EXECUTE FUNCTION fn_tournaments_category();
DROP TRIGGER IF EXISTS trg_bookings_category ON bookings;
CREATE TRIGGER trg_bookings_category
  BEFORE INSERT OR UPDATE OF category, entry_fee, prize_pool ON bookings
  FOR EACH ROW EXECUTE FUNCTION fn_tournaments_category();

-- Same as patch_team_sizes_event_alerts.sql, but single matches alert only
-- when they're prize matches, and the alert names the category.
CREATE OR REPLACE FUNCTION fn_alert_nearby_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  pt    geography := NEW.geo;
  kind  text;
  extra text := '';
BEGIN
  IF COALESCE(NEW.status, 'active') <> 'active' THEN RETURN NEW; END IF;
  -- Tournaments and leagues always; single matches only when there's prize money
  IF NEW.type NOT IN ('tournament', 'league', 'match') THEN RETURN NEW; END IF;
  IF NEW.type = 'match' AND COALESCE(NEW.category, 'friendly') <> 'prize' THEN RETURN NEW; END IF;

  IF pt IS NULL THEN
    SELECT location INTO pt FROM profiles WHERE id = NEW.organiser_id;
  END IF;
  IF pt IS NULL THEN RETURN NEW; END IF;

  kind := CASE WHEN NEW.category = 'prize' THEN 'prize ' ELSE 'friendly ' END
          || CASE NEW.type WHEN 'league' THEN 'league' WHEN 'match' THEN 'match' ELSE 'tournament' END;
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

COMMIT;
