-- ── venues table ────────────────────────────────────────────────────────────
-- A `public.venues` table already exists in this project from
-- supabase/schema.sql (id uuid, name, address, latitude, longitude, sports
-- text[], price_per_hour int, rating, image_color, is_verified, created_by,
-- created_at). This patch does NOT recreate that table (an earlier draft of
-- this file wrongly assumed the table didn't exist yet and used `id text` /
-- `lat`/`lng` — reverted).
--
-- RLS was already enabled on the table but its policies were never actually
-- applied (only the bare CREATE TABLE from schema.sql seems to have run) —
-- confirmed via `select policyname from pg_policies where tablename =
-- 'venues'` returning zero rows while relrowsecurity was true. Without a
-- SELECT policy, anon/authenticated reads are silently denied and
-- lib/venues.ts's fetchVenues() falls back to mock — this bit us in testing
-- (renamed a venue in the DB, app kept showing the old mock name). Policies
-- below restore schema.sql's original intent (public read, authenticated
-- insert, owner update) so future user-submitted-venues work needs no
-- further policy migration.
--
-- This patch also:
--   1. adds `external_id` (dedup key for the mock-data seed below) and
--      `source` (mock | live | user, matches the app's Venue.source field)
--   2. adds a `location geography(Point,4326)` column + GIST index so a
--      future PostGIS ST_DWithin RPC needs no further schema migration —
--      geo filtering itself stays client-side for now (see lib/venues.ts)
--   3. seeds the 89 GTA venues that have a real `coord` in data/mockData.ts
--      (the `offsetKm`-only mock venues were never shown on the Book screen
--      and stay excluded here too)

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS external_id text UNIQUE;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'mock';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

CREATE INDEX IF NOT EXISTS venues_location_gix ON public.venues USING GIST (location);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_select_all" ON public.venues;
CREATE POLICY "venues_select_all" ON public.venues FOR SELECT USING (true);

DROP POLICY IF EXISTS "venues_insert_authenticated" ON public.venues;
CREATE POLICY "venues_insert_authenticated" ON public.venues FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "venues_update_owner" ON public.venues;
CREATE POLICY "venues_update_owner" ON public.venues FOR UPDATE USING (auth.uid() = created_by);

-- ── Seed: 89 GTA venues with real GPS coords ──────────────────────────────
-- `id` is left to its uuid default; `external_id` carries the original
-- mockData.ts id (e.g. 't1', 'gta_t01') purely so this INSERT is idempotent
-- via ON CONFLICT — nothing else in the app reads external_id.
INSERT INTO public.venues (external_id, name, address, sports, price_per_hour, rating, image_color, latitude, longitude, location, is_verified, source)
VALUES
  ('t1', 'Scotiabank Arena', '40 Bay St, Toronto, ON', ARRAY['Basketball','Hockey'], 85000, 4.9, '#1a1a2e', 43.6435, -79.3791, ST_SetSRID(ST_MakePoint(-79.3791, 43.6435), 4326)::geography, true, 'mock'),
  ('t2', 'Rogers Centre', '1 Blue Jays Way, Toronto, ON', ARRAY['Baseball'], 60000, 4.7, '#003087', 43.6414, -79.3894, ST_SetSRID(ST_MakePoint(-79.3894, 43.6414), 4326)::geography, true, 'mock'),
  ('t3', 'BMO Field', '170 Princes Blvd, Toronto, ON', ARRAY['Football'], 45000, 4.6, '#e31837', 43.6335, -79.4179, ST_SetSRID(ST_MakePoint(-79.4179, 43.6335), 4326)::geography, true, 'mock'),
  ('t4', 'Sobeys Stadium', '1 Shoreham Dr, North York, ON', ARRAY['Tennis'], 12000, 4.8, '#00843d', 43.7729, -79.4988, ST_SetSRID(ST_MakePoint(-79.4988, 43.7729), 4326)::geography, true, 'mock'),
  ('t5', 'Varsity Centre', '299 Bloor St W, Toronto, ON', ARRAY['Football','Athletics'], 8000, 4.3, '#002a5c', 43.6664, -79.3993, ST_SetSRID(ST_MakePoint(-79.3993, 43.6664), 4326)::geography, true, 'mock'),
  ('t6', 'Lamport Stadium', '1155 King St W, Toronto, ON', ARRAY['Football'], 6500, 4.1, '#c8102e', 43.6412, -79.4278, ST_SetSRID(ST_MakePoint(-79.4278, 43.6412), 4326)::geography, true, 'mock'),
  ('t7', 'Toronto Cricket Club', '141 Wilson Ave, North York, ON', ARRAY['Cricket'], 9000, 4.4, '#006b3c', 43.7326, -79.4264, ST_SetSRID(ST_MakePoint(-79.4264, 43.7326), 4326)::geography, true, 'mock'),
  ('t8', 'Etobicoke Olympium', '590 Rathburn Rd W, Etobicoke, ON', ARRAY['Basketball','Badminton'], 5500, 4.2, '#ff6b35', 43.6477, -79.562, ST_SetSRID(ST_MakePoint(-79.562, 43.6477), 4326)::geography, true, 'mock'),
  ('tc1', 'High Park Tennis Courts', 'High Park Ave, Toronto, ON', ARRAY['Tennis'], 1500, 4.3, '#16a34a', 43.6464, -79.4637, ST_SetSRID(ST_MakePoint(-79.4637, 43.6464), 4326)::geography, true, 'mock'),
  ('tc2', 'Trinity Bellwoods Tennis Courts', 'Trinity Bellwoods Park, Toronto, ON', ARRAY['Tennis'], 1200, 4.2, '#0284c7', 43.6454, -79.4218, ST_SetSRID(ST_MakePoint(-79.4218, 43.6454), 4326)::geography, true, 'mock'),
  ('tc3', 'Ramsden Park Tennis Courts', 'Ramsden Park, Toronto, ON', ARRAY['Tennis'], 1200, 4.1, '#7c3aed', 43.6754, -79.3907, ST_SetSRID(ST_MakePoint(-79.3907, 43.6754), 4326)::geography, true, 'mock'),
  ('tc4', 'Christie Pits Tennis Courts', 'Christie Pits Park, Toronto, ON', ARRAY['Tennis'], 1000, 4, '#b45309', 43.6632, -79.4197, ST_SetSRID(ST_MakePoint(-79.4197, 43.6632), 4326)::geography, true, 'mock'),
  ('tc5', 'Sunnybrook Park Tennis Courts', 'Sunnybrook Park, Toronto, ON', ARRAY['Tennis'], 1500, 4.4, '#0f766e', 43.7196, -79.3619, ST_SetSRID(ST_MakePoint(-79.3619, 43.7196), 4326)::geography, true, 'mock'),
  ('gta_t01', 'Riverdale Park East Tennis', '550 Broadview Ave, Toronto, ON', ARRAY['Tennis'], 0, 4.1, '#16a34a', 43.6629, -79.3537, ST_SetSRID(ST_MakePoint(-79.3537, 43.6629), 4326)::geography, true, 'mock'),
  ('gta_t02', 'Withrow Park Tennis Courts', 'Bain Ave & Logan Ave, Toronto, ON', ARRAY['Tennis'], 0, 4, '#0284c7', 43.6724, -79.3565, ST_SetSRID(ST_MakePoint(-79.3565, 43.6724), 4326)::geography, true, 'mock'),
  ('gta_t03', 'Dufferin Grove Tennis Courts', '875 Dufferin St, Toronto, ON', ARRAY['Tennis'], 0, 4.2, '#7c3aed', 43.6549, -79.4326, ST_SetSRID(ST_MakePoint(-79.4326, 43.6549), 4326)::geography, true, 'mock'),
  ('gta_t04', 'Stanley Park Tennis Courts', '1055 King St W, Toronto, ON', ARRAY['Tennis'], 0, 3.9, '#b45309', 43.6406, -79.416, ST_SetSRID(ST_MakePoint(-79.416, 43.6406), 4326)::geography, true, 'mock'),
  ('gta_t05', 'Eglinton Park Tennis Courts', '200 Eglinton Ave W, Toronto, ON', ARRAY['Tennis'], 0, 4.1, '#0f766e', 43.6953, -79.4025, ST_SetSRID(ST_MakePoint(-79.4025, 43.6953), 4326)::geography, true, 'mock'),
  ('gta_t06', 'East York Lawn Tennis Club', 'Cosburn Ave, East York, ON', ARRAY['Tennis'], 2500, 4.3, '#16a34a', 43.6937, -79.3221, ST_SetSRID(ST_MakePoint(-79.3221, 43.6937), 4326)::geography, true, 'mock'),
  ('gta_t07', 'Rennie Park Tennis Courts', 'Rennie Park, Etobicoke, ON', ARRAY['Tennis'], 0, 3.8, '#dc2626', 43.7101, -79.5129, ST_SetSRID(ST_MakePoint(-79.5129, 43.7101), 4326)::geography, true, 'mock'),
  ('gta_t08', 'Greenwood Park Tennis Courts', 'Greenwood Ave, Toronto, ON', ARRAY['Tennis'], 0, 4, '#0284c7', 43.67, -79.3295, ST_SetSRID(ST_MakePoint(-79.3295, 43.67), 4326)::geography, true, 'mock'),
  ('gta_t09', 'Dentonia Park Tennis Courts', '1967 Victoria Park Ave, Scarborough, ON', ARRAY['Tennis'], 0, 4, '#7c3aed', 43.6934, -79.2977, ST_SetSRID(ST_MakePoint(-79.2977, 43.6934), 4326)::geography, true, 'mock'),
  ('gta_t10', 'Wallace Emerson Tennis Courts', '1260 Dufferin St, Toronto, ON', ARRAY['Tennis'], 0, 3.9, '#b45309', 43.6622, -79.4356, ST_SetSRID(ST_MakePoint(-79.4356, 43.6622), 4326)::geography, true, 'mock'),
  ('gta_t11', 'Toronto Lawn Tennis Club', '1 Devonshire Pl, Toronto, ON', ARRAY['Tennis'], 8000, 4.8, '#1d4ed8', 43.6748, -79.3951, ST_SetSRID(ST_MakePoint(-79.3951, 43.6748), 4326)::geography, true, 'mock'),
  ('gta_t12', 'York Tennis Club', '155 Renforth Dr, Etobicoke, ON', ARRAY['Tennis'], 7500, 4.6, '#9333ea', 43.6622, -79.5493, ST_SetSRID(ST_MakePoint(-79.5493, 43.6622), 4326)::geography, true, 'mock'),
  ('gta_t13', 'Donalda Club', '12 Donalda Club Rd, North York, ON', ARRAY['Tennis'], 12000, 4.7, '#15803d', 43.7555, -79.332, ST_SetSRID(ST_MakePoint(-79.332, 43.7555), 4326)::geography, true, 'mock'),
  ('gta_t14', 'Lakeshore Lawn Tennis Club', 'Lakeshore Blvd W, Etobicoke, ON', ARRAY['Tennis'], 6500, 4.5, '#0369a1', 43.6191, -79.5109, ST_SetSRID(ST_MakePoint(-79.5109, 43.6191), 4326)::geography, true, 'mock'),
  ('gta_t15', 'Humber Valley Tennis Club', 'Humber Valley Rd, Etobicoke, ON', ARRAY['Tennis'], 6000, 4.4, '#166534', 43.667, -79.5286, ST_SetSRID(ST_MakePoint(-79.5286, 43.667), 4326)::geography, true, 'mock'),
  ('gta_t16', 'Tam O''Shanter Tennis Club', '2481 Birchmount Rd, Scarborough, ON', ARRAY['Tennis'], 5500, 4.2, '#c2410c', 43.7794, -79.2958, ST_SetSRID(ST_MakePoint(-79.2958, 43.7794), 4326)::geography, true, 'mock'),
  ('gta_t17', 'Rosedale Tennis Club', 'Roxborough Dr, Toronto, ON', ARRAY['Tennis'], 9000, 4.5, '#7c3aed', 43.6825, -79.3678, ST_SetSRID(ST_MakePoint(-79.3678, 43.6825), 4326)::geography, true, 'mock'),
  ('gta_t18', 'North York Tennis Club', 'Sheppard Ave, North York, ON', ARRAY['Tennis'], 5000, 4.3, '#0284c7', 43.751, -79.438, ST_SetSRID(ST_MakePoint(-79.438, 43.751), 4326)::geography, true, 'mock'),
  ('gta_t19', 'Clarkson Lawn Tennis Club', '1444 Clarkson Rd N, Mississauga, ON', ARRAY['Tennis'], 5500, 4.4, '#16a34a', 43.5079, -79.6279, ST_SetSRID(ST_MakePoint(-79.6279, 43.5079), 4326)::geography, true, 'mock'),
  ('gta_t20', 'Port Credit Tennis Club', 'Port Credit, Mississauga, ON', ARRAY['Tennis'], 6000, 4.5, '#0284c7', 43.5511, -79.5814, ST_SetSRID(ST_MakePoint(-79.5814, 43.5511), 4326)::geography, true, 'mock'),
  ('gta_t21', 'Streetsville Tennis Club', 'Streetsville, Mississauga, ON', ARRAY['Tennis'], 4500, 4.2, '#7c3aed', 43.5839, -79.7087, ST_SetSRID(ST_MakePoint(-79.7087, 43.5839), 4326)::geography, true, 'mock'),
  ('gta_t22', 'Meadowvale Tennis Courts', 'Meadowvale, Mississauga, ON', ARRAY['Tennis'], 0, 4, '#b45309', 43.5926, -79.7489, ST_SetSRID(ST_MakePoint(-79.7489, 43.5926), 4326)::geography, true, 'mock'),
  ('gta_t23', 'Huron Park Recreation Tennis', 'Huron Park, Mississauga, ON', ARRAY['Tennis'], 0, 3.9, '#0f766e', 43.6046, -79.69, ST_SetSRID(ST_MakePoint(-79.69, 43.6046), 4326)::geography, true, 'mock'),
  ('gta_t24', 'Erindale Park Tennis Courts', 'Erindale Park, Mississauga, ON', ARRAY['Tennis'], 0, 4.1, '#16a34a', 43.5373, -79.6524, ST_SetSRID(ST_MakePoint(-79.6524, 43.5373), 4326)::geography, true, 'mock'),
  ('gta_t25', 'Mississauga Valley Tennis Courts', 'Mississauga Valley Blvd, Mississauga, ON', ARRAY['Tennis'], 0, 4, '#0284c7', 43.5817, -79.6265, ST_SetSRID(ST_MakePoint(-79.6265, 43.5817), 4326)::geography, true, 'mock'),
  ('gta_t26', 'Applewood Tennis Club', 'Applewood, Mississauga, ON', ARRAY['Tennis'], 5000, 4.3, '#7c3aed', 43.596, -79.598, ST_SetSRID(ST_MakePoint(-79.598, 43.596), 4326)::geography, true, 'mock'),
  ('gta_t27', 'Brampton Tennis Club', 'Brampton, ON', ARRAY['Tennis'], 4500, 4.3, '#dc2626', 43.6868, -79.767, ST_SetSRID(ST_MakePoint(-79.767, 43.6868), 4326)::geography, true, 'mock'),
  ('gta_t28', 'Heart Lake Tennis Courts', 'Heart Lake Conservation Area, Brampton, ON', ARRAY['Tennis'], 0, 4, '#16a34a', 43.7326, -79.8001, ST_SetSRID(ST_MakePoint(-79.8001, 43.7326), 4326)::geography, true, 'mock'),
  ('gta_t29', 'Professor''s Lake Tennis Courts', 'Professor''s Lake, Brampton, ON', ARRAY['Tennis'], 0, 3.9, '#0284c7', 43.7168, -79.7583, ST_SetSRID(ST_MakePoint(-79.7583, 43.7168), 4326)::geography, true, 'mock'),
  ('gta_t30', 'Oakville Lawn Tennis & Croquet Club', '109 Randall St, Oakville, ON', ARRAY['Tennis'], 8000, 4.7, '#1d4ed8', 43.4507, -79.6707, ST_SetSRID(ST_MakePoint(-79.6707, 43.4507), 4326)::geography, true, 'mock'),
  ('gta_t31', 'Sixteen Mile Creek Tennis Club', 'Oakville, ON', ARRAY['Tennis'], 5500, 4.3, '#9333ea', 43.5016, -79.6814, ST_SetSRID(ST_MakePoint(-79.6814, 43.5016), 4326)::geography, true, 'mock'),
  ('gta_t32', 'Glen Abbey Community Tennis Courts', 'Glen Abbey, Oakville, ON', ARRAY['Tennis'], 0, 4.1, '#15803d', 43.454, -79.738, ST_SetSRID(ST_MakePoint(-79.738, 43.454), 4326)::geography, true, 'mock'),
  ('gta_t33', 'Bronte Tennis Club', 'Bronte, Oakville, ON', ARRAY['Tennis'], 4500, 4.2, '#0369a1', 43.4039, -79.7197, ST_SetSRID(ST_MakePoint(-79.7197, 43.4039), 4326)::geography, true, 'mock'),
  ('gta_t34', 'Burlington Tennis Club', 'Burlington, ON', ARRAY['Tennis'], 5000, 4.4, '#166534', 43.346, -79.7971, ST_SetSRID(ST_MakePoint(-79.7971, 43.346), 4326)::geography, true, 'mock'),
  ('gta_t35', 'Roseland Tennis Club', 'Roseland, Burlington, ON', ARRAY['Tennis'], 6500, 4.5, '#c2410c', 43.3275, -79.7857, ST_SetSRID(ST_MakePoint(-79.7857, 43.3275), 4326)::geography, true, 'mock'),
  ('gta_t36', 'Tansley Woods Tennis Courts', 'Tansley Woods, Burlington, ON', ARRAY['Tennis'], 0, 3.9, '#7c3aed', 43.3682, -79.7547, ST_SetSRID(ST_MakePoint(-79.7547, 43.3682), 4326)::geography, true, 'mock'),
  ('gta_t37', 'Markham Tennis Club', 'Markham, ON', ARRAY['Tennis'], 4500, 4.3, '#0284c7', 43.8763, -79.2617, ST_SetSRID(ST_MakePoint(-79.2617, 43.8763), 4326)::geography, true, 'mock'),
  ('gta_t38', 'Unionville Club (Tennis)', 'Unionville, Markham, ON', ARRAY['Tennis'], 9000, 4.6, '#1d4ed8', 43.8584, -79.2983, ST_SetSRID(ST_MakePoint(-79.2983, 43.8584), 4326)::geography, true, 'mock'),
  ('gta_t39', 'Milliken Park Tennis Courts', 'Milliken Park, Markham, ON', ARRAY['Tennis'], 0, 4, '#16a34a', 43.8337, -79.2877, ST_SetSRID(ST_MakePoint(-79.2877, 43.8337), 4326)::geography, true, 'mock'),
  ('gta_t40', 'Richmond Hill Racquet Club', 'Richmond Hill, ON', ARRAY['Tennis'], 7000, 4.5, '#9333ea', 43.8697, -79.4386, ST_SetSRID(ST_MakePoint(-79.4386, 43.8697), 4326)::geography, true, 'mock'),
  ('gta_t41', 'Bayview Hill Tennis Club', 'Bayview Hill, Richmond Hill, ON', ARRAY['Tennis'], 6500, 4.4, '#6d28d9', 43.8776, -79.3836, ST_SetSRID(ST_MakePoint(-79.3836, 43.8776), 4326)::geography, true, 'mock'),
  ('gta_t42', 'Woodbridge Tennis Club', 'Woodbridge, Vaughan, ON', ARRAY['Tennis'], 5500, 4.3, '#0f766e', 43.79, -79.5832, ST_SetSRID(ST_MakePoint(-79.5832, 43.79), 4326)::geography, true, 'mock'),
  ('gta_t43', 'Maple Community Centre Tennis', 'Maple, Vaughan, ON', ARRAY['Tennis'], 0, 4, '#16a34a', 43.8461, -79.5051, ST_SetSRID(ST_MakePoint(-79.5051, 43.8461), 4326)::geography, true, 'mock'),
  ('gta_t44', 'G. Ross Lord Park Tennis Courts', '4185 Bathurst St, North York, ON', ARRAY['Tennis'], 0, 4.1, '#0284c7', 43.7726, -79.4802, ST_SetSRID(ST_MakePoint(-79.4802, 43.7726), 4326)::geography, true, 'mock'),
  ('gta_t45', 'Cloverdale Park Tennis Courts', 'Cloverdale Park, North York, ON', ARRAY['Tennis'], 0, 4, '#7c3aed', 43.732, -79.3975, ST_SetSRID(ST_MakePoint(-79.3975, 43.732), 4326)::geography, true, 'mock'),
  ('gta_t46', 'Ajax Tennis Club', 'Ajax, ON', ARRAY['Tennis'], 4000, 4.2, '#b45309', 43.8513, -79.0148, ST_SetSRID(ST_MakePoint(-79.0148, 43.8513), 4326)::geography, true, 'mock'),
  ('gta_t47', 'Pickering Tennis Club', 'Pickering, ON', ARRAY['Tennis'], 4000, 4.1, '#dc2626', 43.8365, -79.0874, ST_SetSRID(ST_MakePoint(-79.0874, 43.8365), 4326)::geography, true, 'mock'),
  ('gta_s01', 'Centennial Park Stadium', 'Centennial Park, Etobicoke, ON', ARRAY['Football'], 6000, 4.4, '#16a34a', 43.6353, -79.5562, ST_SetSRID(ST_MakePoint(-79.5562, 43.6353), 4326)::geography, true, 'mock'),
  ('gta_s02', 'Downsview Park Soccer Fields', '35 Carl Hall Rd, North York, ON', ARRAY['Football'], 4500, 4.2, '#0284c7', 43.7398, -79.475, ST_SetSRID(ST_MakePoint(-79.475, 43.7398), 4326)::geography, true, 'mock'),
  ('gta_s03', 'Toronto Pan Am Sports Centre', '875 Morningside Ave, Scarborough, ON', ARRAY['Football'], 8000, 4.6, '#dc2626', 43.7839, -79.1862, ST_SetSRID(ST_MakePoint(-79.1862, 43.7839), 4326)::geography, true, 'mock'),
  ('gta_s04', 'York Lions Stadium', '4700 Keele St, North York, ON', ARRAY['Football'], 7000, 4.3, '#dc2626', 43.7745, -79.5019, ST_SetSRID(ST_MakePoint(-79.5019, 43.7745), 4326)::geography, true, 'mock'),
  ('gta_s05', 'Humber College Soccer Field', '205 Humber College Blvd, Etobicoke, ON', ARRAY['Football'], 3500, 4, '#f59e0b', 43.7274, -79.5987, ST_SetSRID(ST_MakePoint(-79.5987, 43.7274), 4326)::geography, true, 'mock'),
  ('gta_s06', 'Earl Bales Park Soccer Fields', '4169 Bathurst St, North York, ON', ARRAY['Football'], 3000, 4.1, '#7c3aed', 43.7497, -79.4388, ST_SetSRID(ST_MakePoint(-79.4388, 43.7497), 4326)::geography, true, 'mock'),
  ('gta_s07', 'Chinguacousy Park Soccer Fields', '9050 Bramalea Rd, Brampton, ON', ARRAY['Football'], 4000, 4.3, '#16a34a', 43.7462, -79.7637, ST_SetSRID(ST_MakePoint(-79.7637, 43.7462), 4326)::geography, true, 'mock'),
  ('gta_c01', 'Maple Cricket Club', 'Maple, Vaughan, ON', ARRAY['Cricket'], 5000, 4.5, '#f59e0b', 43.8541, -79.5006, ST_SetSRID(ST_MakePoint(-79.5006, 43.8541), 4326)::geography, true, 'mock'),
  ('gta_c02', 'Scarborough Cricket Association', 'Scarborough, ON', ARRAY['Cricket'], 3500, 4.3, '#0284c7', 43.7643, -79.2467, ST_SetSRID(ST_MakePoint(-79.2467, 43.7643), 4326)::geography, true, 'mock'),
  ('gta_c03', 'Centennial Park Cricket Ground', 'Centennial Park, Etobicoke, ON', ARRAY['Cricket'], 4500, 4.4, '#16a34a', 43.6406, -79.5571, ST_SetSRID(ST_MakePoint(-79.5571, 43.6406), 4326)::geography, true, 'mock'),
  ('gta_c04', 'Humber Cricket Club', 'Humber Valley, Etobicoke, ON', ARRAY['Cricket'], 4000, 4.2, '#dc2626', 43.7217, -79.589, ST_SetSRID(ST_MakePoint(-79.589, 43.7217), 4326)::geography, true, 'mock'),
  ('gta_c05', 'Erin Mills Cricket Ground', 'Erin Mills, Mississauga, ON', ARRAY['Cricket'], 3500, 4.1, '#7c3aed', 43.5437, -79.7288, ST_SetSRID(ST_MakePoint(-79.7288, 43.5437), 4326)::geography, true, 'mock'),
  ('gta_c06', 'Malton Cricket Club', 'Malton, Mississauga, ON', ARRAY['Cricket'], 3000, 4, '#b45309', 43.7186, -79.6565, ST_SetSRID(ST_MakePoint(-79.6565, 43.7186), 4326)::geography, true, 'mock'),
  ('gta_c07', 'Brampton Cricket Club', 'Brampton, ON', ARRAY['Cricket'], 3500, 4.2, '#0f766e', 43.6832, -79.7585, ST_SetSRID(ST_MakePoint(-79.7585, 43.6832), 4326)::geography, true, 'mock'),
  ('gta_b01', 'Mattamy Athletic Centre', '50 Carlton St, Toronto, ON', ARRAY['Basketball'], 15000, 4.6, '#1d4ed8', 43.6594, -79.3798, ST_SetSRID(ST_MakePoint(-79.3798, 43.6594), 4326)::geography, true, 'mock'),
  ('gta_b02', 'Goldring Centre (U of T)', '100 Devonshire Pl, Toronto, ON', ARRAY['Basketball'], 8000, 4.5, '#1d4ed8', 43.6619, -79.3949, ST_SetSRID(ST_MakePoint(-79.3949, 43.6619), 4326)::geography, true, 'mock'),
  ('gta_b03', 'Esther Shiner Stadium', '4101 Bathurst St, North York, ON', ARRAY['Basketball'], 6000, 4.3, '#dc2626', 43.7625, -79.425, ST_SetSRID(ST_MakePoint(-79.425, 43.7625), 4326)::geography, true, 'mock'),
  ('gta_b04', 'Albert Campbell Court', 'Scarborough Civic Centre, Scarborough, ON', ARRAY['Basketball'], 3500, 4.1, '#ea580c', 43.7649, -79.2643, ST_SetSRID(ST_MakePoint(-79.2643, 43.7649), 4326)::geography, true, 'mock'),
  ('gta_b05', 'CAA Centre (Brampton)', '7575 Kennedy Rd S, Brampton, ON', ARRAY['Basketball'], 20000, 4.4, '#7c3aed', 43.589, -79.6474, ST_SetSRID(ST_MakePoint(-79.6474, 43.589), 4326)::geography, true, 'mock'),
  ('gta_b06', 'George Bell Arena', '150 Jefferson Ave, Toronto, ON', ARRAY['Basketball'], 4000, 4, '#0284c7', 43.6422, -79.4696, ST_SetSRID(ST_MakePoint(-79.4696, 43.6422), 4326)::geography, true, 'mock'),
  ('gta_bd01', 'Toronto Badminton Club', 'Toronto, ON', ARRAY['Badminton'], 3500, 4.4, '#8b5cf6', 43.7106, -79.3972, ST_SetSRID(ST_MakePoint(-79.3972, 43.7106), 4326)::geography, true, 'mock'),
  ('gta_bd02', 'Scarborough Badminton Club', 'Scarborough, ON', ARRAY['Badminton'], 3000, 4.2, '#7c3aed', 43.7526, -79.2584, ST_SetSRID(ST_MakePoint(-79.2584, 43.7526), 4326)::geography, true, 'mock'),
  ('gta_bd03', 'Markham Badminton Centre', 'Markham, ON', ARRAY['Badminton'], 4000, 4.5, '#6d28d9', 43.8725, -79.2656, ST_SetSRID(ST_MakePoint(-79.2656, 43.8725), 4326)::geography, true, 'mock'),
  ('gta_bd04', 'Richmond Hill Badminton Club', 'Richmond Hill, ON', ARRAY['Badminton'], 3500, 4.3, '#5b21b6', 43.8828, -79.4365, ST_SetSRID(ST_MakePoint(-79.4365, 43.8828), 4326)::geography, true, 'mock'),
  ('gta_bd05', 'Mississauga Badminton Club', 'Mississauga, ON', ARRAY['Badminton'], 3000, 4.1, '#7c3aed', 43.5895, -79.643, ST_SetSRID(ST_MakePoint(-79.643, 43.5895), 4326)::geography, true, 'mock'),
  ('gta_bb01', 'Christie Pits Baseball Diamond', 'Christie Pits Park, Toronto, ON', ARRAY['Baseball'], 1500, 4.1, '#1d4ed8', 43.662, -79.4197, ST_SetSRID(ST_MakePoint(-79.4197, 43.662), 4326)::geography, true, 'mock'),
  ('gta_bb02', 'Centennial Park Baseball Complex', 'Centennial Park, Etobicoke, ON', ARRAY['Baseball'], 1500, 4, '#0369a1', 43.637, -79.555, ST_SetSRID(ST_MakePoint(-79.555, 43.637), 4326)::geography, true, 'mock'),
  ('gta_bb03', 'Scarborough Baseball Complex', 'Scarborough, ON', ARRAY['Baseball'], 2000, 4.2, '#1e40af', 43.7543, -79.238, ST_SetSRID(ST_MakePoint(-79.238, 43.7543), 4326)::geography, true, 'mock'),
  ('gta_bb04', 'Etobicoke Baseball Complex', 'Etobicoke, ON', ARRAY['Baseball'], 2000, 4, '#1d4ed8', 43.641, -79.549, ST_SetSRID(ST_MakePoint(-79.549, 43.641), 4326)::geography, true, 'mock')
ON CONFLICT (external_id) DO NOTHING;
