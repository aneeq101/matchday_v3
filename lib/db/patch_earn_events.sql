-- ============================================================
-- MatchDay — Phase 2c Earn Events Patch
-- Run once in Supabase SQL Editor
-- ============================================================

-- ── Add status to tournaments ─────────────────────────────────
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- ── Add payment tracking to tournament_registrations ─────────
ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';
ALTER TABLE tournament_registrations ADD COLUMN IF NOT EXISTS amount_paid    int  NOT NULL DEFAULT 0;

-- ── Auto-count trigger on tournament_registrations ────────────
CREATE OR REPLACE FUNCTION fn_tournament_participants_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tournaments
    SET participants_count = participants_count + 1
    WHERE id = NEW.tournament_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tournaments
    SET participants_count = GREATEST(participants_count - 1, 0)
    WHERE id = OLD.tournament_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_participants ON tournament_registrations;
CREATE TRIGGER trg_tournament_participants
  AFTER INSERT OR DELETE ON tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION fn_tournament_participants_count();

-- ── RLS on tournaments ────────────────────────────────────────
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
DROP POLICY IF EXISTS "tournaments_insert" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update" ON tournaments;
DROP POLICY IF EXISTS "tournaments_delete" ON tournaments;

CREATE POLICY "tournaments_select" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tournaments_update" ON tournaments FOR UPDATE USING (auth.uid() = organiser_id);
CREATE POLICY "tournaments_delete" ON tournaments FOR DELETE USING (auth.uid() = organiser_id);

-- ── RLS on tournament_registrations ──────────────────────────
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tourney_reg_select" ON tournament_registrations;
DROP POLICY IF EXISTS "tourney_reg_insert" ON tournament_registrations;
DROP POLICY IF EXISTS "tourney_reg_delete" ON tournament_registrations;

CREATE POLICY "tourney_reg_select" ON tournament_registrations FOR SELECT USING (true);
CREATE POLICY "tourney_reg_insert" ON tournament_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tourney_reg_delete" ON tournament_registrations FOR DELETE
  USING (auth.uid() = user_id);
