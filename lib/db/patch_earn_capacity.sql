-- ============================================================
-- MatchDay — Play to Earn: capacity enforcement + RLS re-assert
-- Run once in Supabase SQL Editor
-- ============================================================
--
-- Two things were missing from patch_earn_events.sql:
--
-- 1. Nothing stopped a tournament from being over-registered. The client
--    (earn.tsx) now hides the Register button once full, but that's a UI
--    nicety, not a guarantee — a race between two users registering for the
--    last spot, or a client bug, could still overbook. This adds a BEFORE
--    INSERT trigger that locks the tournament row and rejects the insert if
--    already at capacity, so the guarantee lives in the database.
--
-- 2. After the venues migration turned up a table with RLS enabled but zero
--    policies (silently blocking all reads for months, undetected because
--    the mock-data fallback masked it — see lib/venues.ts and the venues
--    patch), the same class of bug is worth ruling out here too. The
--    policies below are byte-for-byte what patch_earn_events.sql already
--    defines; re-running them is a no-op if they're already live, and a
--    fix if they somehow aren't. DROP + CREATE is idempotent either way.

-- ── Capacity guard ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_tournament_capacity_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  current_count int;
  max_count     int;
BEGIN
  SELECT participants_count, max_participants INTO current_count, max_count
  FROM tournaments
  WHERE id = NEW.tournament_id
  FOR UPDATE;

  IF current_count >= max_count THEN
    RAISE EXCEPTION 'This event is full';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_capacity_guard ON tournament_registrations;
CREATE TRIGGER trg_tournament_capacity_guard
  BEFORE INSERT ON tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION fn_tournament_capacity_guard();

-- ── RLS re-assert (idempotent — see note above) ────────────────
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
DROP POLICY IF EXISTS "tournaments_insert" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update" ON tournaments;
DROP POLICY IF EXISTS "tournaments_delete" ON tournaments;

CREATE POLICY "tournaments_select" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tournaments_update" ON tournaments FOR UPDATE USING (auth.uid() = organiser_id);
CREATE POLICY "tournaments_delete" ON tournaments FOR DELETE USING (auth.uid() = organiser_id);

ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tourney_reg_select" ON tournament_registrations;
DROP POLICY IF EXISTS "tourney_reg_insert" ON tournament_registrations;
DROP POLICY IF EXISTS "tourney_reg_delete" ON tournament_registrations;

CREATE POLICY "tourney_reg_select" ON tournament_registrations FOR SELECT USING (true);
CREATE POLICY "tourney_reg_insert" ON tournament_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tourney_reg_delete" ON tournament_registrations FOR DELETE USING (auth.uid() = user_id);
