-- ── matches ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  title          text        NOT NULL,
  sport          text        NOT NULL DEFAULT 'Football',
  sport_emoji    text        NOT NULL DEFAULT '⚽',
  players_format text        NOT NULL DEFAULT '11v11',
  match_date     text        NOT NULL,
  location       text        NOT NULL,
  status         text        NOT NULL DEFAULT 'upcoming'
                             CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select" ON matches FOR SELECT USING (true);
CREATE POLICY "matches_insert" ON matches FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "matches_update" ON matches FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "matches_delete" ON matches FOR DELETE USING (auth.uid() = creator_id);

-- ── match_players ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_players (
  match_id   uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL,
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_players_select" ON match_players FOR SELECT USING (true);
CREATE POLICY "match_players_insert" ON match_players FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "match_players_delete" ON match_players FOR DELETE USING (auth.uid() = player_id);

-- ── bookings: add status column if not already present ───────────────────────
-- (bookings table was created directly in Supabase, not via migration.sql)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status text DEFAULT 'confirmed';
