-- ── bookings table ──────────────────────────────────────────────────────────
-- This table was never in migration.sql; it was assumed to exist in Supabase.
-- Run this if bookings are not saving from the Book tab.

CREATE TABLE IF NOT EXISTS bookings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL,
  venue_name       text        NOT NULL DEFAULT '',
  venue_address    text,
  sport            text        NOT NULL DEFAULT 'Football',
  date             text        NOT NULL DEFAULT '',
  time_slot        text        NOT NULL DEFAULT '',
  duration_hours   int         NOT NULL DEFAULT 1,
  players_count    int         NOT NULL DEFAULT 10,
  special_requests text,
  total_price      numeric     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'confirmed'
                               CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select" ON bookings;
DROP POLICY IF EXISTS "bookings_insert" ON bookings;
DROP POLICY IF EXISTS "bookings_update" ON bookings;

-- Users can only see their own bookings
CREATE POLICY "bookings_select" ON bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only create bookings for themselves
CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookings (e.g. cancel)
CREATE POLICY "bookings_update" ON bookings
  FOR UPDATE USING (auth.uid() = user_id);
