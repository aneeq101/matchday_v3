-- ============================================================
-- MatchDay — Phase 2b Migration
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS + ON CONFLICT DO NOTHING
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY,
  name          text    NOT NULL DEFAULT 'Player',
  initials      text             DEFAULT '',
  avatar_color  text             DEFAULT '#16a34a',
  avatar_url    text,
  bio           text             DEFAULT '',
  area          text             DEFAULT '',
  gender        text             DEFAULT 'male',
  privacy       text             DEFAULT 'public',
  is_demo       boolean          DEFAULT false,
  join_date     text             DEFAULT '',
  stats         jsonb            DEFAULT '{"matches":0,"wins":0,"rank":"Bronze"}',
  created_at    timestamptz      DEFAULT now()
);

-- Ensure all profiles columns exist (handles pre-existing tables from earlier runs)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name          text        NOT NULL DEFAULT 'Player';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS initials      text                 DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_color  text                 DEFAULT '#16a34a';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio           text                 DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area          text                 DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender        text                 DEFAULT 'male';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy       text                 DEFAULT 'public';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_demo       boolean              DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS join_date     text                 DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stats         jsonb                DEFAULT '{"matches":0,"wins":0,"rank":"Bronze"}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at    timestamptz          DEFAULT now();

CREATE TABLE IF NOT EXISTS profile_sports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sport       text NOT NULL,
  skill       text NOT NULL DEFAULT 'Beginner',
  emoji       text          DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS profile_sports_unique ON profile_sports (profile_id, sport);

CREATE TABLE IF NOT EXISTS posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  author_name         text NOT NULL DEFAULT 'Player',
  author_initials     text NOT NULL DEFAULT 'P',
  author_avatar_color text          DEFAULT '#16a34a',
  text                text          DEFAULT '',
  looking_for         text          DEFAULT '',
  sports              jsonb         DEFAULT '[]',
  likes_count         int           DEFAULT 0,
  comments_count      int           DEFAULT 0,
  created_at          timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournaments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  type               text NOT NULL DEFAULT 'tournament',
  sport              text NOT NULL,
  sport_emoji        text          DEFAULT '🏆',
  organiser_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  date_text          text          DEFAULT 'TBD',
  location           text          DEFAULT '',
  participants_count int           DEFAULT 0,
  max_participants   int           DEFAULT 16,
  entry_fee          int           DEFAULT 0,
  prize_pool         int           DEFAULT 0,
  created_at         timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournament_registrations (
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  registered_at timestamptz DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_message_text text        DEFAULT '',
  last_message_at   timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  last_read_at    timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL,
  sender_name     text        DEFAULT '',
  text            text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- ── Triggers ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_post_likes_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSE
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_likes_count ON post_likes;
CREATE TRIGGER trg_post_likes_count
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION fn_post_likes_count();

CREATE OR REPLACE FUNCTION fn_tournament_participants()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tournaments SET participants_count = participants_count + 1 WHERE id = NEW.tournament_id;
  ELSE
    UPDATE tournaments SET participants_count = GREATEST(0, participants_count - 1) WHERE id = OLD.tournament_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_tournament_participants ON tournament_registrations;
CREATE TRIGGER trg_tournament_participants
  AFTER INSERT OR DELETE ON tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION fn_tournament_participants();

CREATE OR REPLACE FUNCTION fn_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations
    SET last_message_text = NEW.text, last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conversation_last_message ON messages;
CREATE TRIGGER trg_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION fn_conversation_last_message();

-- Auto-create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, initials, avatar_url, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Player'),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', 'P'), 2)),
    NEW.raw_user_meta_data->>'avatar_url',
    '#16a34a'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- ── Row-Level Security ────────────────────────────────────────

ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_sports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                  ENABLE ROW LEVEL SECURITY;

-- Drop old policies before recreating (idempotent)
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Profiles
CREATE POLICY "profiles_select"  ON profiles FOR SELECT USING (privacy = 'public' OR is_demo OR auth.uid() = id);
CREATE POLICY "profiles_insert"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id OR is_demo);
CREATE POLICY "profiles_update"  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Profile sports
CREATE POLICY "profile_sports_select" ON profile_sports FOR SELECT USING (true);
CREATE POLICY "profile_sports_all"    ON profile_sports FOR ALL    USING (true);

-- Posts
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (auth.uid() = author_id);

-- Post likes
CREATE POLICY "post_likes_select" ON post_likes FOR SELECT USING (true);
CREATE POLICY "post_likes_insert" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_likes_delete" ON post_likes FOR DELETE USING  (auth.uid() = user_id);

-- Tournaments
CREATE POLICY "tournaments_select" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tournaments_update" ON tournaments FOR UPDATE USING  (auth.uid() = organiser_id);

-- Tournament registrations
CREATE POLICY "tourney_reg_select" ON tournament_registrations FOR SELECT USING (true);
CREATE POLICY "tourney_reg_insert" ON tournament_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tourney_reg_delete" ON tournament_registrations FOR DELETE USING  (auth.uid() = user_id);

-- Conversations (only participants can see)
CREATE POLICY "conv_select" ON conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = auth.uid())
);
CREATE POLICY "conv_insert" ON conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Conversation participants
CREATE POLICY "conv_part_select" ON conversation_participants FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "conv_part_insert" ON conversation_participants FOR INSERT WITH CHECK (true);

-- Messages (only participants can read/write)
CREATE POLICY "msg_select" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid())
);
CREATE POLICY "msg_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Enable Realtime for messages
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── Seed Demo Data ────────────────────────────────────────────

-- Drop the FK from profiles.id → auth.users so demo (non-auth) profiles can be inserted.
-- Real users are still linked by convention (profile.id = auth.uid()) via the trigger.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 6 demo player profiles (from mockData.ts)
INSERT INTO profiles (id, name, initials, avatar_color, bio, area, gender, privacy, is_demo, join_date, stats)
VALUES
  ('00000000-0000-0000-0000-000000000001','Ali Hassan',    'AH','#16a34a','Passionate footballer and cricket enthusiast. Always up for a good game!','Model Town','male',  'public',true,'Jan 2024','{"matches":47,"wins":32,"rank":"Gold"}'),
  ('00000000-0000-0000-0000-000000000002','Sara Ahmed',    'SA','#8b5cf6','Tennis and badminton lover. Looking for competitive partners.','Gulberg',   'female','public',true,'Mar 2024','{"matches":31,"wins":22,"rank":"Silver"}'),
  ('00000000-0000-0000-0000-000000000003','Bilal Khan',    'BK','#f59e0b','Cricket is life. Captain of local cricket club since 2022.','Johar Town', 'male',  'public',true,'Feb 2024','{"matches":63,"wins":45,"rank":"Platinum"}'),
  ('00000000-0000-0000-0000-000000000004','Fatima Rizvi',  'FR','#ec4899','Basketball player. Private profile.','Bahria Town','female','private',true,'Apr 2024','{"matches":19,"wins":11,"rank":"Bronze"}'),
  ('00000000-0000-0000-0000-000000000005','Usman Tariq',   'UT','#3b82f6','Football midfielder. Weekend warrior looking for pickup games.','Wapda Town','male',  'public',true,'Dec 2023','{"matches":28,"wins":15,"rank":"Silver"}'),
  ('00000000-0000-0000-0000-000000000006','Zara Siddiqui', 'ZS','#06b6d4','Badminton champion. Looking for serious players to train with.','Garden Town','female','public',true,'Jun 2024','{"matches":54,"wins":41,"rank":"Gold"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profile_sports (profile_id, sport, skill, emoji) VALUES
  ('00000000-0000-0000-0000-000000000001','Football',  'Advanced',     '⚽'),
  ('00000000-0000-0000-0000-000000000001','Cricket',   'Beginner',     '🏏'),
  ('00000000-0000-0000-0000-000000000002','Tennis',    'Intermediate', '🎾'),
  ('00000000-0000-0000-0000-000000000002','Badminton', 'Advanced',     '🏸'),
  ('00000000-0000-0000-0000-000000000003','Cricket',   'Advanced',     '🏏'),
  ('00000000-0000-0000-0000-000000000004','Basketball','Intermediate', '🏀'),
  ('00000000-0000-0000-0000-000000000005','Football',  'Intermediate', '⚽'),
  ('00000000-0000-0000-0000-000000000006','Badminton', 'Advanced',     '🏸')
ON CONFLICT (profile_id, sport) DO NOTHING;

-- 5 demo posts
INSERT INTO posts (id, author_id, author_name, author_initials, author_avatar_color, text, looking_for, sports, likes_count, comments_count, created_at)
VALUES
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Ali Hassan','AH','#16a34a',
   'Looking for someone to practice football this weekend at Model Town Sports Complex. Any takers? Bringing my own gear!',
   'Practice Partner','[{"name":"Football","skill":"Advanced","emoji":"⚽"}]',12,3, now()-'2 hours'::interval),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Sara Ahmed','SA','#8b5cf6',
   'Anyone up for a doubles tennis match at Gulberg Sports Arena? Looking for a partner for Saturday evening.',
   'Doubles Partner','[{"name":"Tennis","skill":"Intermediate","emoji":"🎾"}]',8,5, now()-'4 hours'::interval),
  ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','Bilal Khan','BK','#f59e0b',
   'Forming a cricket team for the Ramadan Cup. Need 4 more experienced players. We train every Tuesday and Thursday at DHA Cricket Ground.',
   'Team Members','[{"name":"Cricket","skill":"Advanced","emoji":"🏏"}]',24,11, now()-'6 hours'::interval),
  ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','Usman Tariq','UT','#3b82f6',
   'Pickup football game this Sunday at 5pm at Wapda Town ground. All skill levels welcome — come have fun!',
   'Pickup Games','[{"name":"Football","skill":"Intermediate","emoji":"⚽"}]',31,17, now()-'1 day'::interval),
  ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006','Zara Siddiqui','ZS','#06b6d4',
   'Looking for a badminton coach or mentor to help improve my smash technique. Intermediate to advanced level preferred.',
   'Coach/Mentor','[{"name":"Badminton","skill":"Advanced","emoji":"🏸"}]',15,7, now()-'1 day'::interval)
ON CONFLICT (id) DO NOTHING;

-- 4 demo tournaments
INSERT INTO tournaments (id, name, type, sport, sport_emoji, date_text, location, participants_count, max_participants, entry_fee, prize_pool)
VALUES
  ('20000000-0000-0000-0000-000000000001','Lahore Premier Football League','league',    'Football','⚽','Jun 15, 2025','Model Town Sports Complex',18,24,5000,150000),
  ('20000000-0000-0000-0000-000000000002','Ramadan Cricket Cup',          'tournament','Cricket', '🏏','Jun 22, 2025','DHA Cricket Ground',        10,16,3000, 80000),
  ('20000000-0000-0000-0000-000000000003','Tennis Doubles Showdown',      'tournament','Tennis',  '🎾','Jul 5, 2025', 'Gulberg Sports Arena',      6, 16,2000, 40000),
  ('20000000-0000-0000-0000-000000000004','Sunday Pickup Football',       'match',     'Football','⚽','May 25, 2025','Wapda Town Ground',         14,22,500,  0)
ON CONFLICT (id) DO NOTHING;

-- Create profiles for any existing auth users
INSERT INTO profiles (id, name, initials, avatar_url, avatar_color)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email,'@',1), 'Player'),
  UPPER(LEFT(COALESCE(raw_user_meta_data->>'full_name','P'),2)),
  raw_user_meta_data->>'avatar_url',
  '#16a34a'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
