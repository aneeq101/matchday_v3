-- ── Auto-join match creator ──────────────────────────────────────────────────
-- Runs AFTER INSERT on matches, inside the same transaction.
-- SECURITY DEFINER bypasses RLS so this always fires even before policies apply.
-- The match_player_count_trigger then increments current_players to 1 atomically.

CREATE OR REPLACE FUNCTION auto_join_match_creator()
RETURNS trigger AS $$
BEGIN
  INSERT INTO match_players (match_id, player_id)
  VALUES (NEW.id, NEW.creator_id)
  ON CONFLICT (match_id, player_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_join_creator_trigger ON matches;
CREATE TRIGGER auto_join_creator_trigger
AFTER INSERT ON matches
FOR EACH ROW EXECUTE FUNCTION auto_join_match_creator();
