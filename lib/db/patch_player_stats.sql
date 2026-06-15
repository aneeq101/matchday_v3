-- ============================================================
-- Patch: player_stats — per-sport detailed stats with dummy data
-- Run once in Supabase SQL Editor.
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS player_stats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sport       text NOT NULL,
  matches     int  NOT NULL DEFAULT 0,
  wins        int  NOT NULL DEFAULT 0,
  losses      int  NOT NULL DEFAULT 0,
  draws       int  NOT NULL DEFAULT 0,
  sport_stats jsonb NOT NULL DEFAULT '{}',
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (profile_id, sport)
);

-- 2. RLS
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_stats_select" ON player_stats;
DROP POLICY IF EXISTS "player_stats_write"  ON player_stats;

CREATE POLICY "player_stats_select" ON player_stats
  FOR SELECT USING (true);

CREATE POLICY "player_stats_write" ON player_stats
  FOR ALL USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- 3. Dummy data for demo players
-- Ali Hassan (00000000-…-001): Football + Cricket
INSERT INTO player_stats (profile_id, sport, matches, wins, losses, draws, sport_stats) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Football', 47, 32, 10, 5,
   '{"goals":23,"assists":14,"clean_sheets":0,"yellow_cards":3,"red_cards":0}'),
  ('00000000-0000-0000-0000-000000000001', 'Cricket',  28, 18,  8, 2,
   '{"runs":1240,"wickets":34,"batting_avg":"44.3","bowling_avg":"22.1","centuries":3,"fifties":8}')
ON CONFLICT (profile_id, sport) DO UPDATE SET
  matches     = EXCLUDED.matches,
  wins        = EXCLUDED.wins,
  losses      = EXCLUDED.losses,
  draws       = EXCLUDED.draws,
  sport_stats = EXCLUDED.sport_stats,
  updated_at  = now();

-- Sara Ahmed (00000000-…-002): Tennis + Badminton
INSERT INTO player_stats (profile_id, sport, matches, wins, losses, draws, sport_stats) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Tennis',   31, 22,  9, 0,
   '{"aces":145,"double_faults":38,"first_serve_pct":"68%","sets_won":48,"games_won":312}'),
  ('00000000-0000-0000-0000-000000000002', 'Badminton', 24, 17,  7, 0,
   '{"sets_won":42,"points_scored":892,"smashes":234,"drop_shots":156}')
ON CONFLICT (profile_id, sport) DO UPDATE SET
  matches     = EXCLUDED.matches,
  wins        = EXCLUDED.wins,
  losses      = EXCLUDED.losses,
  draws       = EXCLUDED.draws,
  sport_stats = EXCLUDED.sport_stats,
  updated_at  = now();

-- Bilal Khan (00000000-…-003): Cricket + Football
INSERT INTO player_stats (profile_id, sport, matches, wins, losses, draws, sport_stats) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Cricket',  63, 45, 14, 4,
   '{"runs":3280,"wickets":87,"batting_avg":"52.1","bowling_avg":"18.4","centuries":9,"fifties":22}'),
  ('00000000-0000-0000-0000-000000000003', 'Football', 18, 12,  4, 2,
   '{"goals":6,"assists":9,"clean_sheets":0,"yellow_cards":2,"red_cards":0}')
ON CONFLICT (profile_id, sport) DO UPDATE SET
  matches     = EXCLUDED.matches,
  wins        = EXCLUDED.wins,
  losses      = EXCLUDED.losses,
  draws       = EXCLUDED.draws,
  sport_stats = EXCLUDED.sport_stats,
  updated_at  = now();

-- Fatima Rizvi (00000000-…-004): Basketball
INSERT INTO player_stats (profile_id, sport, matches, wins, losses, draws, sport_stats) VALUES
  ('00000000-0000-0000-0000-000000000004', 'Basketball', 19, 11, 8, 0,
   '{"points":387,"rebounds":124,"assists":67,"blocks":23,"steals":41,"three_pointers":52}')
ON CONFLICT (profile_id, sport) DO UPDATE SET
  matches     = EXCLUDED.matches,
  wins        = EXCLUDED.wins,
  losses      = EXCLUDED.losses,
  draws       = EXCLUDED.draws,
  sport_stats = EXCLUDED.sport_stats,
  updated_at  = now();

-- Usman Tariq (00000000-…-005): Football
INSERT INTO player_stats (profile_id, sport, matches, wins, losses, draws, sport_stats) VALUES
  ('00000000-0000-0000-0000-000000000005', 'Football', 28, 15, 10, 3,
   '{"goals":8,"assists":19,"clean_sheets":0,"yellow_cards":5,"red_cards":1}')
ON CONFLICT (profile_id, sport) DO UPDATE SET
  matches     = EXCLUDED.matches,
  wins        = EXCLUDED.wins,
  losses      = EXCLUDED.losses,
  draws       = EXCLUDED.draws,
  sport_stats = EXCLUDED.sport_stats,
  updated_at  = now();

-- Zara Siddiqui (00000000-…-006): Badminton + Tennis
INSERT INTO player_stats (profile_id, sport, matches, wins, losses, draws, sport_stats) VALUES
  ('00000000-0000-0000-0000-000000000006', 'Badminton', 54, 41, 13, 0,
   '{"sets_won":98,"points_scored":2340,"smashes":612,"drop_shots":389}'),
  ('00000000-0000-0000-0000-000000000006', 'Tennis',    22, 15,  7, 0,
   '{"aces":89,"double_faults":21,"first_serve_pct":"72%","sets_won":31,"games_won":198}')
ON CONFLICT (profile_id, sport) DO UPDATE SET
  matches     = EXCLUDED.matches,
  wins        = EXCLUDED.wins,
  losses      = EXCLUDED.losses,
  draws       = EXCLUDED.draws,
  sport_stats = EXCLUDED.sport_stats,
  updated_at  = now();
