-- ── Match joining support ────────────────────────────────────────────────────
-- Run this after patch_matches.sql if the matches + match_players tables exist.

-- Add max_players and current_players tracking columns
ALTER TABLE matches ADD COLUMN IF NOT EXISTS max_players int NOT NULL DEFAULT 2;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_players int NOT NULL DEFAULT 0;

-- Trigger: auto-update current_players when match_players rows are inserted/deleted
CREATE OR REPLACE FUNCTION update_match_current_players()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE matches SET current_players = current_players + 1 WHERE id = NEW.match_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE matches SET current_players = GREATEST(0, current_players - 1) WHERE id = OLD.match_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS match_player_count_trigger ON match_players;
CREATE TRIGGER match_player_count_trigger
AFTER INSERT OR DELETE ON match_players
FOR EACH ROW EXECUTE FUNCTION update_match_current_players();

-- RLS: anyone can read match_players (to see who joined)
DROP POLICY IF EXISTS "match_players_select" ON match_players;
CREATE POLICY "match_players_select" ON match_players
  FOR SELECT USING (true);

-- RLS: players can join if match is upcoming and has slots
DROP POLICY IF EXISTS "match_players_insert" ON match_players;
CREATE POLICY "match_players_insert" ON match_players
  FOR INSERT WITH CHECK (
    auth.uid() = player_id
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE id = match_id
        AND status = 'upcoming'
        AND current_players < max_players
    )
  );

-- RLS: players can leave (delete their own row)
DROP POLICY IF EXISTS "match_players_delete" ON match_players;
CREATE POLICY "match_players_delete" ON match_players
  FOR DELETE USING (auth.uid() = player_id);
