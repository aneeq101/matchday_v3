-- ============================================================
-- MatchDay — Play to Earn: update demo tournaments to GTA/CAD
-- Run once in Supabase SQL Editor
-- ============================================================
--
-- migration.sql seeded 4 demo tournaments with fixed UUIDs, Lahore
-- locations, and PKR-scale entry fees/prize pools. Tournaments (like venues)
-- are now Canada-based, and data/mockData.ts's TOURNAMENTS fallback array
-- was updated to match — but the live DB rows are what the Earn tab
-- actually reads, so they need updating too or the app keeps showing the
-- old Lahore data regardless of the mock-data change.

UPDATE tournaments SET
  name = 'Toronto Premier Football League',
  location = 'BMO Field',
  date_text = 'Aug 20, 2026',
  entry_fee = 25,
  prize_pool = 750
WHERE id = '20000000-0000-0000-0000-000000000001';

UPDATE tournaments SET
  name = 'GTA Cricket Cup',
  location = 'Maple Cricket Club',
  date_text = 'Aug 28, 2026',
  entry_fee = 20,
  prize_pool = 400
WHERE id = '20000000-0000-0000-0000-000000000002';

UPDATE tournaments SET
  name = 'Tennis Doubles Showdown',
  location = 'High Park Tennis Courts',
  date_text = 'Sep 5, 2026',
  entry_fee = 15,
  prize_pool = 200
WHERE id = '20000000-0000-0000-0000-000000000003';

UPDATE tournaments SET
  name = 'Sunday Pickup Football',
  location = 'Centennial Park Stadium',
  date_text = 'Aug 15, 2026',
  entry_fee = 5,
  prize_pool = 0
WHERE id = '20000000-0000-0000-0000-000000000004';
