BEGIN;  -- all-or-nothing: if any statement fails, nothing is changed

-- ============================================================
-- MatchDay — Phase 3/4 completion patch
-- Teams, privacy settings, nearby players (PostGIS), push tokens,
-- help & support tickets, account deletion.
--
-- Run once in Supabase SQL Editor. Safe to re-run (idempotent).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── 1. Profile settings columns ─────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_messages  boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS messages_from   jsonb   NOT NULL DEFAULT '{"male":true,"female":true,"undisclosed":true}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_in_nearby  boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_enabled    boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude        double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude       double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location        geography(Point, 4326);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_location_gix ON profiles USING GIST (location);

-- Keep `location` in sync with latitude/longitude automatically
CREATE OR REPLACE FUNCTION fn_profiles_sync_location()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_location ON profiles;
CREATE TRIGGER trg_profiles_sync_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_profiles_sync_location();

-- "Friends Only" (privacy = 'private') profiles are visible to people they follow.
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  privacy = 'public'
  OR is_demo
  OR auth.uid() = id
  OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = profiles.id AND f.following_id = auth.uid())
);

-- Demo players get real GTA locations so they appear in Nearby Players
UPDATE profiles SET latitude = 43.6465, longitude = -79.4637 WHERE id = '00000000-0000-0000-0000-000000000001' AND latitude IS NULL; -- High Park
UPDATE profiles SET latitude = 43.6475, longitude = -79.4136 WHERE id = '00000000-0000-0000-0000-000000000002' AND latitude IS NULL; -- Trinity Bellwoods
UPDATE profiles SET latitude = 43.6629, longitude = -79.3957 WHERE id = '00000000-0000-0000-0000-000000000003' AND latitude IS NULL; -- U of T
UPDATE profiles SET latitude = 43.6677, longitude = -79.3494 WHERE id = '00000000-0000-0000-0000-000000000004' AND latitude IS NULL; -- Riverdale
UPDATE profiles SET latitude = 43.7057, longitude = -79.3983 WHERE id = '00000000-0000-0000-0000-000000000005' AND latitude IS NULL; -- Eglinton Park
UPDATE profiles SET latitude = 43.5890, longitude = -79.6441 WHERE id = '00000000-0000-0000-0000-000000000006' AND latitude IS NULL; -- Mississauga

-- ── 2. Nearby players RPC (PostGIS) ─────────────────────────
-- Returns profiles within radius_km of the given point, nearest first.
-- Respects show_in_nearby and the profiles_select visibility rules above.
CREATE OR REPLACE FUNCTION nearby_players(lat double precision, lng double precision, radius_km double precision)
RETURNS TABLE (id uuid, distance_km double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
  SELECT p.id,
         ST_Distance(p.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) / 1000.0 AS distance_km
  FROM   profiles p
  WHERE  p.location IS NOT NULL
    AND  p.show_in_nearby
    AND  p.id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    AND  ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_km * 1000)
  ORDER  BY distance_km
  LIMIT  200;
$$;

GRANT EXECUTE ON FUNCTION nearby_players(double precision, double precision, double precision) TO anon, authenticated;

-- ── 3. Messaging privacy enforced server-side ───────────────
CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me          uuid := auth.uid();
  conv_id     uuid;
  target      profiles%ROWTYPE;
  my_gender   text;
  gender_key  text;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO target FROM profiles WHERE id = other_user_id;
  IF FOUND AND NOT COALESCE(target.is_demo, false) THEN
    IF NOT COALESCE(target.allow_messages, true) THEN
      RAISE EXCEPTION 'MESSAGES_DISABLED';
    END IF;
    SELECT gender INTO my_gender FROM profiles WHERE id = me;
    gender_key := CASE WHEN my_gender IN ('male', 'female') THEN my_gender ELSE 'undisclosed' END;
    IF COALESCE((target.messages_from ->> gender_key)::boolean, true) = false THEN
      RAISE EXCEPTION 'MESSAGES_DISABLED';
    END IF;
  END IF;

  SELECT cp1.conversation_id INTO conv_id
  FROM   conversation_participants cp1
  JOIN   conversation_participants cp2
         ON cp1.conversation_id = cp2.conversation_id
  WHERE  cp1.user_id = me
    AND  cp2.user_id = other_user_id
  LIMIT  1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  conv_id := gen_random_uuid();
  INSERT INTO conversations (id) VALUES (conv_id);
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES
    (conv_id, me),
    (conv_id, other_user_id);

  RETURN conv_id;
END;
$$;

-- ── 4. Teams ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  sport        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  area         text NOT NULL DEFAULT '',
  owner_id     uuid NOT NULL,
  is_open      boolean NOT NULL DEFAULT true,   -- anyone can join without an invite
  max_members  int NOT NULL DEFAULT 15,
  member_count int NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id   uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL,
  role      text NOT NULL DEFAULT 'member',     -- 'captain' | 'member'
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select" ON teams;
DROP POLICY IF EXISTS "teams_insert" ON teams;
DROP POLICY IF EXISTS "teams_update" ON teams;
DROP POLICY IF EXISTS "teams_delete" ON teams;
CREATE POLICY "teams_select" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_insert" ON teams FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "teams_update" ON teams FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "teams_delete" ON teams FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
DROP POLICY IF EXISTS "team_members_delete" ON team_members;
CREATE POLICY "team_members_select" ON team_members FOR SELECT USING (true);
-- Join an open team yourself, or the captain adds someone
CREATE POLICY "team_members_insert" ON team_members FOR INSERT WITH CHECK (
  (auth.uid() = user_id AND EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND (t.is_open OR t.owner_id = auth.uid())))
  OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
);
-- Leave yourself, or the captain removes someone
CREATE POLICY "team_members_delete" ON team_members FOR DELETE USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
);

-- Owner auto-joins as captain (SECURITY DEFINER — same pattern as matches)
CREATE OR REPLACE FUNCTION fn_team_owner_autojoin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'captain')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_team_owner_autojoin ON teams;
CREATE TRIGGER trg_team_owner_autojoin
  AFTER INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION fn_team_owner_autojoin();

-- Capacity check + keep member_count accurate
CREATE OR REPLACE FUNCTION fn_team_members_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t teams%ROWTYPE;
BEGIN
  SELECT * INTO t FROM teams WHERE id = NEW.team_id FOR UPDATE;
  IF t.member_count >= t.max_members THEN
    RAISE EXCEPTION 'TEAM_FULL';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_team_members_capacity ON team_members;
CREATE TRIGGER trg_team_members_capacity
  BEFORE INSERT ON team_members
  FOR EACH ROW EXECUTE FUNCTION fn_team_members_capacity();

CREATE OR REPLACE FUNCTION fn_team_members_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE teams SET member_count = (
    SELECT count(*) FROM team_members WHERE team_id = COALESCE(NEW.team_id, OLD.team_id)
  ) WHERE id = COALESCE(NEW.team_id, OLD.team_id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_team_members_count ON team_members;
CREATE TRIGGER trg_team_members_count
  AFTER INSERT OR DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION fn_team_members_count();

-- Demo teams (with demo players as members)
INSERT INTO teams (id, name, sport, description, area, owner_id, is_open, max_members) VALUES
  ('30000000-0000-0000-0000-000000000001', 'High Park FC',       'Football',  'Casual 7-a-side every Sunday morning. All levels welcome.', 'Toronto',     '00000000-0000-0000-0000-000000000001', true, 14),
  ('30000000-0000-0000-0000-000000000002', 'Queen West Smashers', 'Badminton', 'Weeknight doubles crew. Bring your own racquet.',           'Toronto',     '00000000-0000-0000-0000-000000000006', true, 8),
  ('30000000-0000-0000-0000-000000000003', 'Maple Strikers CC',   'Cricket',   'Weekend tape-ball and hard-ball cricket in the GTA.',        'Mississauga', '00000000-0000-0000-0000-000000000003', true, 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO team_members (team_id, user_id, role) VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'member'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'member'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'member'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'member')
ON CONFLICT DO NOTHING;

-- ── 5. Help & Support tickets ───────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  email      text NOT NULL DEFAULT '',
  category   text NOT NULL DEFAULT 'General',
  message    text NOT NULL,
  status     text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_tickets_select" ON support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert" ON support_tickets;
CREATE POLICY "support_tickets_select" ON support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "support_tickets_insert" ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 6. Push notifications ───────────────────────────────────
-- Every row inserted into `notifications` (and every chat message) is also sent
-- as a phone push via Expo's push service, if the recipient has a push token and
-- push enabled. Uses pg_net (async HTTP) so a failure never blocks the insert.
-- Push tokens live in their own table: profiles are publicly readable,
-- tokens must only be visible to their owner.
CREATE TABLE IF NOT EXISTS push_tokens (
  user_id    uuid PRIMARY KEY,
  token      text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_tokens_own" ON push_tokens;
CREATE POLICY "push_tokens_own" ON push_tokens FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Helper: send one Expo push to a user (no-op if no token / push disabled)
CREATE OR REPLACE FUNCTION send_expo_push(p_user_id uuid, p_title text, p_body text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tok text;
  enabled boolean;
BEGIN
  SELECT token INTO tok FROM push_tokens WHERE user_id = p_user_id;
  SELECT push_enabled INTO enabled FROM profiles WHERE id = p_user_id;
  IF tok IS NULL OR tok = '' OR NOT COALESCE(enabled, true) THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
    body    := jsonb_build_object(
      'to', tok, 'title', p_title, 'body', p_body, 'sound', 'default',
      'data', COALESCE(p_data, '{}'::jsonb)
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- never block the caller because a push failed
  NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION send_expo_push(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION fn_send_push_on_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM send_expo_push(
    NEW.user_id, NEW.title, NEW.body,
    COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object('type', NEW.type)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_send_push_on_notification ON notifications;
CREATE TRIGGER trg_send_push_on_notification
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION fn_send_push_on_notification();

-- New chat messages push to the other participant (not added to the
-- notifications list — the Messages inbox already shows them)
CREATE OR REPLACE FUNCTION fn_push_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT cp.user_id FROM conversation_participants cp
    WHERE  cp.conversation_id = NEW.conversation_id AND cp.user_id <> NEW.sender_id
  LOOP
    PERFORM send_expo_push(
      r.user_id,
      COALESCE(NULLIF(NEW.sender_name, ''), 'New message'),
      LEFT(COALESCE(NEW.text, ''), 120),
      jsonb_build_object('type', 'new_message', 'conversation_id', NEW.conversation_id)
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_push_new_message ON messages;
CREATE TRIGGER trg_push_new_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION fn_push_new_message();

-- ── 7. Delete my account ────────────────────────────────────
-- Removes the caller's data and their auth user. Irreversible.
CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  DELETE FROM teams                  WHERE owner_id = me;
  DELETE FROM team_members           WHERE user_id = me;
  DELETE FROM follows                WHERE follower_id = me OR following_id = me;
  DELETE FROM notifications          WHERE user_id = me;
  DELETE FROM post_likes             WHERE user_id = me;
  DELETE FROM posts                  WHERE author_id = me;
  DELETE FROM match_players          WHERE player_id = me;
  DELETE FROM matches                WHERE creator_id = me;
  DELETE FROM tournament_registrations WHERE user_id = me;
  DELETE FROM bookings               WHERE user_id = me;
  DELETE FROM support_tickets        WHERE user_id = me;
  DELETE FROM push_tokens            WHERE user_id = me;
  DELETE FROM profiles               WHERE id = me;   -- cascades profile_sports, player_stats
  DELETE FROM auth.users             WHERE id = me;
END;
$$;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;

COMMIT;
