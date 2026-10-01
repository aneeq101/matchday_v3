# CLAUDE.md — matchday_v3

Auto-loaded by Claude Code at session start. Keep this current as the project evolves.

---

## What This App Is

**MatchDay** — Expo (React Native + web) sports social network and venue booking app. Players find nearby players, organise matches, join tournaments, and book sports venues. Uses real GPS. Backend is Supabase (auth, Postgres + PostGIS, Realtime, Storage); screens show local mock data first and fall back to it if the database can't be reached.

**Owner / git user:** aneeq101 | **Repo:** aneeq101/matchday_v3 | **Branch:** main

---

## Tech Stack

| | |
|---|---|
| Framework | Expo SDK 54, managed workflow |
| Language | TypeScript (strict) |
| Routing | expo-router v6 (file-based) |
| React | React 19.1.0 / React Native 0.81.5 |
| Icons | `@expo/vector-icons` — Ionicons only |
| Maps (native) | `react-native-maps` 1.20.1 |
| Maps (web) | `react-leaflet` 4.x + `leaflet` 1.9.4 |
| GPS | `expo-location` |
| Slider | `@react-native-community/slider` (native), custom `<input type="range">` (web) |
| Backend | Supabase (`@supabase/supabase-js` pinned **2.105.4**) — Postgres + PostGIS, RLS, RPCs, Realtime, Storage |
| Push | `expo-notifications` + `expo-device`; sent from the DB via `pg_net` → Expo push API |
| Builds | EAS (`eas.json`; project `@aneeq101/matchday-v3`) |
| Styling | `StyleSheet.create` — no external UI lib |
| Primary colour | `#16a34a` (green) |

---

## File Map

```
app/
  _layout.tsx              # Root Stack, auth gate, push registration + notification tap routing
  (auth)/sign-in.tsx, sign-up.tsx   # Email/password + Google sign-in (grass background)
  auth/callback.tsx        # OAuth redirect handler
  (tabs)/
    _layout.tsx            # Bottom tab bar (5 tabs)
    index.tsx              # The Hood — social feed + nearby players (PostGIS)
    myturf.tsx             # My Turf — bookings, organized/joined/open matches, my events, quick actions
    earn.tsx               # Play to Earn — tournaments / leagues / pickup matches, create event
    book.tsx               # Book Venue — search, map, booking modal
    profile.tsx            # Profile, sports + stats, privacy & messaging, menu
  messages.tsx / chat.tsx  # Conversation list / 1-on-1 chat (Realtime)
  comments.tsx             # Post comments
  notifications.tsx        # In-app notifications (tap routes to team / tournament / challenges / messages)
  followers.tsx            # Followers / following (tap a row → player profile)
  looking-now.tsx          # Players currently looking for games
  edit-profile.tsx         # Edit name, bio, area, avatar
  my-teams.tsx / team.tsx  # Teams list + team detail (captain tools, Challenge this Team)
  my-tournaments.tsx       # Events I organise / joined
  tournament.tsx           # Event details: sign-ups, knockout bracket / league table + fixtures, organiser results
  challenges.tsx           # Challenge matches (player vs player, team vs team)
  ratings.tsx              # All ratings & reviews for a player/team (?kind=player|team&id=&name=)
  match-history.tsx        # Recorded games, head-to-head, Rematch (?userId=&name=&sport=)
  welcome.tsx              # First-run flow: pick sports → optional level/position/self-rating per sport → done
  statistics.tsx           # Aggregated player statistics
  privacy.tsx              # Privacy & Security (nearby, push, password, sign out all, delete account)
  help.tsx                 # Help & Support (FAQ + tickets)

components/
  BookMap.native.tsx / .web.tsx         # react-native-maps (iOS/Android) / react-leaflet (web)
  RadiusSlider.native.tsx / .web.tsx    # slider / <input type="range">
  DatePickerField.native.tsx / .web.tsx # calendar date picker
  *.d.ts                                # type declarations for the platform-split components
  LocationPickerModal.tsx  # Full-screen venue picker (map + list) — Create Event / bookings
  VenueList.tsx            # Inline venue list filtered by sport — challenge "Where"
  PlayerProfileModal.tsx   # Player profile sheet (Follow / Message / Challenge)
  TeamFormModal.tsx        # Create / edit team form
  BracketView.tsx          # Knockout bracket drawing with connector lines
  ChallengeModal.tsx       # New challenge sheet
  NotifBell.tsx            # Bell icon with unread count
  InAppPopups.tsx          # All in-app popups (one queue): new challenges + updates, rating requests, new ratings (shows the rating), badges, nearby events, READY FOR MATCH DAY?, results; Realtime + on-foreground check
  MatchDayPanel.tsx        # Event page + Organize Match details: ready list / "I'm ready", final score / "Record final score"
  AskRatingsModal.tsx      # Ask people you've played with to rate you / your team
  RatingsSection.tsx       # Ratings summary, badge progress, skill bars, reviews (profile modal, team page, ratings screen)
  RateModal.tsx            # Rate a player/team: overall 1–10, per-skill 1–10, conduct stars, review
  BadgeChip.tsx            # Bronze/Silver/Gold/Platinum/Diamond pill
  SportDetailsEditor.tsx   # Level + position fields + optional self-rating (welcome flow + Profile Add/Edit Sport)

lib/                       # Service layer — screens never call Supabase directly
  supabase.ts, AuthContext.tsx          # client + session
  players.ts, profile.ts, follows.ts, settings.ts, statistics.ts, sportStats.ts
  posts.ts, comments.ts, chatService.ts, notifications.ts, push.ts, support.ts
  venues.ts, matches.ts, teams.ts
  tournaments.ts           # events, sign-ups, bracket fetch, start/record-result RPCs
  bracket.ts               # pure bracket/fixture/standings logic (no Supabase)
  challenges.ts            # challenge RPC wrappers
  ratingRules.ts           # pure: 1–10 level scale, NTRP map, skills per sport (player + team), badge tiers/rules
  ratings.ts               # rating_summary / submit_rating RPC wrappers, ratings list, delete
  ratingRequests.ts        # request_ratings / suggestions / decline wrappers
  matchday.ts              # ack_ready / ready list / final scores; toISODate, matchDayReached, canRecordFinal
  history.ts               # match_history / verified_record RPCs, rivalsFrom()
  sportProfile.ts          # pure: profile sports, skill levels, per-sport fields, self-rating skills, summarizeDetails()
  onboarding.ts            # when to show the welcome flow (user_metadata.onboarding_done)
  sportRules.ts            # sport formats, booking limits, event entry rules (min 4, singles/doubles/teams), TEAM_FORMATS squad sizes
  db/                      # SQL migrations / patches (all run in Supabase except the updated patch_matchday.sql + patch_match_history.sql)

data/
  mockData.ts              # All types + mock/demo data + venue helpers

hooks/
  useUserLocation.ts        # GPS: expo-location (native) / navigator.geolocation (web)

utils/
  geo.ts                   # Coord, offsetCoord, distanceKm, latDeltaForRadius, formatDistance
```

---

## Book Screen — Current State

`app/(tabs)/book.tsx` — venue search, map and booking.

**Features live:**
- Search bar (name / address / sport)
- Sport filter pills: All / Football / Cricket / Tennis / Basketball / Badminton / Baseball
- Radius slider 1–20 km, syncs bidirectionally with map zoom
- List ↔ Map toggle
- Venues load from the Supabase `venues` table (`fetchVenues()`), mock `VENUES` shown first / used as fallback
- Live venue search via Overpass API (OpenStreetMap) — **currently switched off** (`LIVE_SEARCH_ENABLED = false`); when on, triggers with sport filter + GPS
- Booking modal: date, time slot, duration, sport, players, special requests
- Booking confirmed success screen

**Venue filtering rules:**
- Only venues with `coord` (absolute GPS) are shown — `offsetKm` venues are excluded
- No GPS → radius filter skipped, all real venues shown, live search disabled
- With GPS → radius filter + distance sort + live Overpass search merged in

**BOOKING_SPORTS:** `['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball']`

**Currency note:** UI shows "CAD" hardcoded everywhere (Book, Play to Earn, My Turf, My Tournaments, web map — last PKR labels removed 2026-09-30). Venues/tournaments are GTA-based.

**Map vs List venue sets (important):**
- `mapVenues` = search + sport filter only, **no radius filter** — markers never disappear when user zooms or changes radius
- `listVenues` = search + sport + radius filter — keeps the list manageable
- Both are computed in `book.tsx` from `searchSportMockVenues` (despite the name, these are the DB venues in `dbVenues`) + `filteredLiveVenues` (Overpass, empty while live search is off)

---

## Venue Data (`data/mockData.ts` + Supabase `venues` table)

The app reads venues from Supabase; `mockData.ts` is the fallback. The 89 GTA venues below were seeded into the `venues` table by `lib/db/patch_venues.sql` (the mock ID is kept in `venues.external_id`). **A venue added only to mockData.ts will not appear while the DB is reachable — add it to the `venues` table too.**

**Venue type fields:**
- `coord?: { latitude, longitude }` — absolute GPS → shown on map + list
- `offsetKm?: { dx, dy }` — relative to user GPS → excluded from Book screen
- `source?: 'mock' | 'live'` — `'live'` for Overpass results (shows blue "Live" badge)
- `pricePerHour: 0` + no source → "Contact Venue" shown

**GTA venues with real GPS (IDs):**
- `t1`–`t8` — Major venues: Scotiabank Arena, Rogers Centre, BMO Field, Sobeys Stadium, Varsity Centre, Lamport Stadium, Toronto CC, Etobicoke Olympium
- `tc1`–`tc5` — Public tennis (Toronto): High Park, Trinity Bellwoods, Ramsden Park, Christie Pits, Sunnybrook
- `gta_t01`–`gta_t10` — Additional public tennis courts (Toronto: Riverdale, Withrow, Dufferin Grove, Stanley, Eglinton, etc.)
- `gta_t11`–`gta_t18` — Private tennis clubs (Toronto: Toronto Lawn TC, York TC, Donalda, Lakeshore, Humber Valley, Tam O'Shanter, Rosedale, North York TC)
- `gta_t19`–`gta_t26` — Tennis (Mississauga): Clarkson LTC, Port Credit TC, Streetsville TC, Meadowvale, Huron Park, Erindale Park, Mississauga Valley, Applewood TC
- `gta_t27`–`gta_t29` — Tennis (Brampton): Brampton TC, Heart Lake, Professor's Lake
- `gta_t30`–`gta_t33` — Tennis (Oakville): Oakville Lawn TC, Sixteen Mile Creek TC, Glen Abbey, Bronte TC
- `gta_t34`–`gta_t36` — Tennis (Burlington): Burlington TC, Roseland TC, Tansley Woods
- `gta_t37`–`gta_t39` — Tennis (Markham): Markham TC, Unionville Club, Milliken Park
- `gta_t40`–`gta_t41` — Tennis (Richmond Hill): Richmond Hill Racquet Club, Bayview Hill TC
- `gta_t42`–`gta_t43` — Tennis (Vaughan): Woodbridge TC, Maple Community
- `gta_t44`–`gta_t45` — Tennis (North York extra): G. Ross Lord Park, Cloverdale Park
- `gta_t46`–`gta_t47` — Tennis (East GTA): Ajax TC, Pickering TC
- `gta_s01`–`gta_s07` — Football/Soccer fields
- `gta_c01`–`gta_c07` — Cricket grounds
- `gta_b01`–`gta_b06` — Basketball arenas
- `gta_bd01`–`gta_bd05` — Badminton clubs
- `gta_bb01`–`gta_bb04` — Baseball complexes

When adding new venues: insert into the Supabase `venues` table (name, address, latitude, longitude, sports[], price_per_hour, external_id) and mirror in mockData.ts with `coord` (not `offsetKm`), ID prefixed `gta_`, `pricePerHour: 0` for free/public courts.

---

## Critical Technical Decisions

### Babel config
`react-native-reanimated` 4.x plugin needs `react-native-worklets/plugin` (not installed). Both disabled:
```js
presets: [['babel-preset-expo', { worklets: false, reanimated: false }]]
```

### Web output: `"single"` in `app.json`
Leaflet accesses `window` at module load — breaks SSR. `"output": "single"` → client-side SPA only.

### Platform-split components
Metro resolves `.native.tsx` vs `.web.tsx` automatically. Never import `react-native-maps` in web code or `react-leaflet` in native code.

### Native map — uncontrolled region
`MapView` uses `initialRegion` (not `region`). Programmatic zoom/pan via `mapRef.current.animateToRegion()`. Two refs break feedback loops:
- `programmaticRef` — set before `animateToRegion`, suppresses resulting `onRegionChangeComplete`
- `mapDrivenRef` — set in `onRegionChangeComplete`, suppresses the `useEffect` re-animation

### Live search toggle
`book.tsx` has `const LIVE_SEARCH_ENABLED = false;` near the top. Set to `true` to re-enable the Overpass API live venue search. When false: the useEffect returns early, `liveVenues` stays `[]`, the status bar and header spinner are hidden. All Overpass code is intact.

### Web map markers — hover tooltip
`BookMap.web.tsx` uses react-leaflet `<Tooltip direction="top" offset={[0, -68]}>` inside each `<Marker>` to show the venue name on hover. The `<Popup>` (on click) shows full details + Book Now. Both coexist — `Tooltip` for quick peek, `Popup` for booking action.

### Native map markers — VenueMarker component
Custom markers use a `VenueMarker` component with `tracksViewChanges={false}` from mount.

**Root cause of Android invisible markers:** emoji fonts load asynchronously on Android. When react-native-maps takes a native view snapshot for the marker, emoji Text nodes may not have rendered yet → blank marker. Shadows/elevation also interfere with the snapshot.

**Fix:** ASCII sport labels (F/C/B/T/D/X) on a plain solid colored circle. No emoji, no shadow, no elevation, no border inside the marker view. `PROVIDER_GOOGLE` explicit on Android.

**`tracksViewChanges` pattern (per-marker state):**
- Starts `true` → snapshot taken after Android layout pass
- Flipped to `false` after 500ms via `setTimeout` → freezes snapshot, stops overhead
- Flipped back to `true` for 300ms when `isSelected` changes → captures colour change
- This avoids both the "blank snapshot" problem (false from mount) and the "continuous re-render" problem (always true)

- Marker: plain `borderRadius` circle, no border, no shadow/elevation, single ASCII letter
- Selected marker: dark background + larger size (tracked by the flip-back pattern above)
- Sport emoji lives only in the bottom tap-card overlay
- Sport colors: Tennis=#2563eb, Football=#16a34a, Cricket=#d97706, Basketball=#ea580c, Badminton=#7c3aed, Baseball=#1d4ed8

### Native marker tap — bottom card overlay
`<Callout>` removed (unreliable on Android). Marker `onPress` → sets `selected` state → floating bottom card renders over map. Tap map background (`MapView onPress`) dismisses it.

### GPS fallback
`useUserLocation` returns `null` on permission deny — no hardcoded fallback city. Map centres on venue centroid (Toronto area).

### Overpass API live search
- Debounced 800 ms, cancellation flag prevents stale responses
- 3-endpoint fallback: `overpass-api.de` → `overpass.kumi.systems` → `overpass.openstreetmap.ru`
- 12-second `AbortController` timeout per endpoint
- Results capped at 30, `source: 'live'`, `pricePerHour: 0`

---

## Backend & Feature Plan

Full plan in `PLAN.md`. Summary:

- **Backend**: Supabase (PostgreSQL + PostGIS for geo queries, Realtime for messaging, Storage for media)
- **Auth**: Supabase Auth (email/password + Google + Apple)
- **Payments**: Stripe via Supabase Edge Functions
- **Push**: Expo Notifications + FCM/APNs

**Phase status (2026-09-30):** Phase 1 auth ✅ · Phase 2 bookings, social, messaging, matches, Play to Earn ✅ · Phase 3 social graph, nearby players, push plumbing ✅ · Phase 4 teams, statistics, brackets, challenges ✅ · Phase 5 Stripe ❌ not started · Phase 6 production: EAS project linked, FCM + first build + store submission + Sentry ❌. Apple sign-in is in the plan but not built.

## Phase 3/4 completion (2026-09-30) — `lib/db/patch_phase4_complete.sql` run in Supabase 2026-09-30

- **My Teams** — `app/my-teams.tsx` (list + Discover + create), `app/team.tsx` (detail, add players, edit, leave/delete), `lib/teams.ts`, `components/TeamFormModal.tsx`. Tables `teams`, `team_members`; owner auto-joins as captain via trigger; `TEAM_FULL` capacity trigger; demo teams `30000000-…-00{1-3}`.
- **Statistics** — `app/statistics.tsx` + `lib/statistics.ts` (player_stats + bookings/matches/tournaments/teams/follows). Stat field defs moved to `lib/sportStats.ts`.
- **Privacy & Security** — `app/privacy.tsx` (show-in-nearby, push toggle, change password, sign out everywhere, delete account via `delete_my_account()` RPC). Profile tab Privacy & Messaging card now persists to `profiles` (`privacy`, `allow_messages`, `messages_from`) via `lib/settings.ts`; enforced server-side in `get_or_create_conversation` (raises `MESSAGES_DISABLED`) — use `openConversation()` from `lib/chatService.ts` to get a user-facing error. "Friends Only" = `privacy='private'` → visible only to people the user follows (profiles_select policy).
- **Help & Support** — `app/help.tsx` (FAQ + contact form → `support_tickets`), `lib/support.ts`.
- **Nearby players (PostGIS)** — `profiles.latitude/longitude/location` (+ sync trigger), `nearby_players(lat,lng,radius_km)` RPC; Hood saves user location and calls `fetchNearbyPlayers()`; falls back to demo players if RPC fails / nobody nearby.
- **Push notifications** — `lib/push.ts` (expo-notifications), tokens in private `push_tokens` table. DB triggers send via Expo push API using `pg_net`: every `notifications` row + every chat message. EAS project linked 2026-09-30 (`@aneeq101/matchday-v3`, projectId `9fc1c7c7-af97-4887-a623-6f9c13d2b077` in app.json). Still needs Firebase/FCM + a build — see "Your to-do list". Not supported on web or Expo Go Android.
- **Payment Methods** — intentionally still "coming soon" (Stripe deferred).
- **EAS** — `eas.json` added (development / preview APK / production). `@supabase/supabase-js` pinned to **2.105.4**: 2.106+ contains a dynamic `import()` that Hermes can't compile, which breaks release builds.

## Brackets & Challenges (2026-09-30) — `lib/db/patch_brackets_challenges.sql` run in Supabase 2026-09-30

- **Tournaments**: `tournaments.entrant_type` ('player'|'team'), `min_participants`, `format`, `champion_name`; `status` = 'active' (sign-ups open) → 'in_progress' → 'completed'. Team events: the captain signs up with `tournament_registrations.team_id`.
- **Bracket logic** is pure TS in `lib/bracket.ts` (knockout with byes, round robin, standings, round names). Organiser taps Start → app shuffles + generates → `start_tournament(id, matches jsonb)` RPC saves `tournament_matches`. Results via `record_match_result()` (winner auto-advances; knockout can't be edited once the next round is played). No direct write policies on `tournament_matches`.
- Type 'tournament' = knockout bracket (`components/BracketView.tsx`), 'league' = round robin table + fixtures, 'match' = sign-up list only.
- The sign-up guard + counter triggers are SECURITY DEFINER — before this patch RLS hid the tournament row from them for non-organisers, so counts/capacity silently didn't work.
- **Challenges**: `challenges` table, RPCs `create_challenge` / `respond_challenge` / `cancel_challenge` / `record_challenge_result` (all send notifications). Demo players/teams auto-accept. Entry points: player profile modal (Challenge button), team page, My Turf quick action, `/challenges?kind=&opponentId=&opponentName=&sport=`.
- Player profiles open from The Hood, Looking Now, Followers, team members, tournament sign-ups (`fetchPlayer(id)` in `lib/players.ts`).
- Demo: players 007/008, football teams `30000000-…-004..007`, tournaments `20000000-…-005` (tennis knockout in progress) and `…-006` (5-a-side cup with byes); demo league `…-001` has fixtures.
- **Entry rules** (`eventRules()` in `lib/sportRules.ts`, enforced by `trg_tournaments_validate` from `lib/db/patch_event_rules.sql`): knockouts/leagues need ≥4 entrants; Tennis/Badminton singles → players, doubles → pairs (2-player teams), other sports → teams. Entry type is only checked on INSERT so older events keep their sign-ups. Pickup "match" events need the full line-up.
- **Challenge venues**: "Where" opens `components/VenueList.tsx` — venues from `fetchVenues()` filtered to the challenge's sport, nearest first, or type a custom place.
- SQL was tested locally against a Postgres+PostGIS container with Supabase stubs (auth.uid, roles, net.http_post) replaying all lib/db migrations.

## Ratings, reviews & badges (2026-10-01) — `lib/db/patch_ratings.sql` run in Supabase 2026-10-01

- **Who rates whom:** a player, or a team via its captain ("Rate as" picker), rates a player or a team in one sport. One rating per rater per target per sport — rating again updates it. Can't rate yourself, your own team, or your own team's members on the team's behalf.
- **What's rated:** overall level 1–10 (required, fixed meanings in `RATING_LEVELS`: 5 Intermediate, 7 Advanced, 9 Elite, 10 Pro; Tennis also shows NTRP), optional per-skill 1–10 (`PLAYER_SKILLS` / `TEAM_SKILLS` — e.g. tennis serve/return/forehand/backhand/volley/overhead/topspin/slice/movement/consistency/tactics/mental; tennis & badminton teams = doubles pairs), sportsmanship + reliability 1–5, review ≤500 chars. Skills can be skipped (e.g. a keeper's finishing).
- **Badges:** Bronze 5+, Silver 6+, Gold 7+, Platinum 8+, Diamond 9+. Earned when ≥3 different people rate the overall at that level or higher AND they are ≥ half of all raters for that sport; only the last 12 months count; a person rating as themselves and as their team counts once. Rule lives only in `rating_summary()` (SQL); tier list is mirrored in `BADGE_TIERS` (`lib/ratingRules.ts`) — keep in step with `fn_rating_tiers()`.
- **Played together** (✓ on reviews) is computed by `fn_played_together()`: completed challenge or tournament match between the sides, same team, or same pickup match.
- `ratings` table: no insert/update policies (writes only via `submit_rating()`), delete own; select follows profile visibility. Notifications `new_rating` / `new_badge` (data `rating_player_id` → /ratings, or `team_id` → team page).
- UI: Ratings & Reviews section + badge chips in `PlayerProfileModal` and `app/team.tsx`; Profile tab menu → "Ratings & Badges"; `/ratings` full list.
- Demo ratings: Daniel Park Platinum (tennis), Zara Diamond (badminton), Ali Gold (football), Bilal Gold (cricket), Priya Silver (tennis), Sara/Usman no badge yet (2 ratings); teams: Daniel & Priya Gold, Scarborough Lions Silver, High Park FC Bronze.
- SQL tested locally (Postgres+PostGIS with Supabase stubs, all migrations replayed): badges, majority rule, double-count guard, validation errors, RLS (no direct writes, private profiles hidden, delete own only), notifications, re-run safety. UI type-checks and bundles for web + Android, but has **not been clicked through**.

## Team sizes + nearby event alerts (2026-10-01) — `lib/db/patch_team_sizes_event_alerts.sql` run in Supabase 2026-10-01

- **Team formats** (`TEAM_FORMATS` in `lib/sportRules.ts`, mirrored by `fn_team_formats()` in SQL — keep in step): Tennis/Badminton `Doubles` exactly 2; Football 5-a-side 5–10 / 7-a-side 7–14 / 11-a-side 11–25; Cricket 8-a-side 8–12 / 11-a-side 11–16; Basketball 3x3 3–4 / 5-on-5 5–15; Baseball 9 players 9–20; Hockey 6 on ice 6–22. `teams.format` column; `trg_teams_validate_size` checks on insert and when size/format/sport change (errors `TEAM_SIZE_INVALID: …`, `TEAM_FORMAT_INVALID`, `TEAM_TOO_SMALL`); missing format is guessed (older app versions). `TeamFormModal` has a Format picker and the squad stepper is clamped to the format (pairs show a fixed "2 players").
- Patch backfills formats for existing teams; demo badminton "Queen West Smashers" had 3 members → demo Sara removed so it's Zara + the owner's account.
- **Nearby event alerts:** `trg_alert_nearby_event` (AFTER INSERT on tournaments) → `notifications` rows of type `nearby_event` (data `tournament_id`), which the existing push trigger sends to phones. Fires for tournaments, leagues, and matches with entry fee > 0, status active. Recipients: not demo, not organiser, `event_alerts` on, play that sport (`profile_sports`), location saved in the last 90 days within their `event_alert_radius_km` (5/10/25/50, default 25), max 3 per 24 h, nearest 500. Event point = venue coord from `LocationPickerModal` (now passes `coord`) → else venue whose name starts the location text → else (alert only) organiser's location. `tournaments.latitude/longitude/geo` + sync trigger. Settings in Privacy & Security ("Nearby Event Alerts" + radius chips), `lib/settings.ts`.
- **Popup (2026-10-01):** `nearby_event` is in `POPUP_TYPES` → "NEW NEAR YOU" card in `InAppPopups` (View & join / Not interested), only while sign-ups are open and not full. Before this, alerts only reached the Notifications list (no phone push without an FCM build), so users never noticed them.
- Tested locally (all migrations replayed + patch run twice) with a copy of the live team data. Bundles for web + Android; not clicked through. Phone pushes still need Firebase + a build; the alerts show in the in-app Notifications list regardless.

## First-run sports setup (2026-10-01) — no SQL needed

- `app/welcome.tsx` (modal): 1) "Which sports do you play?" multi-select tiles → picked sports are saved immediately (level Intermediate) 2) one optional page per sport via `components/SportDetailsEditor.tsx`: level (Beginner/Intermediate/Advanced with plain descriptions), position-type chips (`SPORT_FIELDS`, some multi-select), and a collapsed "Rate your own game" (`SELF_RATING_SKILLS`, answers Working on it / Solid / Strength) 3) "You're all set" tips. Skip on every step; back button; un-picking a just-saved sport removes it.
- Shown automatically once (`lib/onboarding.ts`): signed-in, inside the tabs, no `profile_sports`, and `user_metadata.onboarding_done` not set. Opening it sets the flag (cross-device, via `supabase.auth.updateUser`); existing players with sports get the flag silently. Re-entry: Profile → My Sports empty state "Set up my sports".
- Stored in `profile_sports.skill` + `details` jsonb (labels as keys, multi-select joined with ", "). Self-ratings are only shown as a "Strengths: …" line (`summarizeDetails`) — they don't affect ratings/badges.
- Profile tab: tap a sport card to edit it (same editor), long-press to remove; Add Sport sheet uses the same editor (old NTRP/Role-only fields replaced; old saved details still display).

## Challenge popup + rating requests (2026-10-01) — `lib/db/patch_challenge_popup.sql` + `lib/db/patch_rating_requests.sql` run in Supabase 2026-10-01

- **Challenge popup** (`components/ChallengePopup.tsx`, mounted in `app/_layout.tsx` while signed in): Realtime INSERT on `challenges` (filter `opponent_user_id`) + check on start/foreground for pending, unseen (`opponent_seen_at` null), last-7-days challenges. Accept / Decline (confirm) / Decide later (`mark_challenge_seen`); accepted → Message challenger / My challenges. Queue for several. `respond_challenge` now also sets `opponent_seen_at`. **Update popups** for the other side when a challenge is accepted / declined / called off / given a result: driven by unread `challenge_update` notifications (Realtime on `notifications` + check on start/foreground, last 7 days), closing marks them read; updates on one challenge collapse to its latest state; demo auto-accepts skipped (`isDemoOpponent`). Foreground push banners suppressed for `challenge` + `challenge_update` (`lib/push.ts`). `challenges` and `notifications` added to `supabase_realtime`.
- **Rating requests:** `rating_requests` table; `request_ratings()` (subject = yourself or a team you captain; skips self, demo, own team members, anyone asked in 30 days / pending; ≤10 per send, ≤20/day), `rating_request_suggestions()` (played together → teammates → follows), `decline_rating_request()`, trigger `trg_ratings_complete_requests` marks a request done when that person rates. Notification `rating_request` → `/ratings?kind&id&name&rate=<sport>` (banner + auto-open RateModal). Entry points: Profile tap sport → "Ask players to rate my …", Ratings & Badges screen, team page (captain).
- Profile tab: tapping a sport card already opens Edit (level, positions, self-rating) since `c17f8f9`.
- SQL tested with `lib/db/testing/replay.sh` (incl. re-run); app type-checks and bundles for web + Android; not clicked through.

## Rating popups (2026-10-01) — `lib/db/patch_rating_popups.sql` run in Supabase 2026-10-01

- `components/ChallengePopup.tsx` → renamed **`components/InAppPopups.tsx`**: one queue for all popups so they never stack. Notification-driven items use `POPUP_TYPES` in `lib/notifications.ts` (`challenge_update`, `rating_request`, `new_rating`, `new_badge`), fetched unread (7 days) on start/foreground + Realtime; closing marks read.
- `rating_request` → Rate now (`/ratings?...&rate=sport`) / Not now (`decline_rating_request`) / Later. Skipped if the request is no longer pending.
- `new_rating` → shows the actual rating via `data.rating_id` (`fetchRating` in `lib/ratings.ts`); Say thanks (chat) / All my ratings. Notifications without `rating_id` (sent before the patch) are matched by time with `findRatingNear()`; old badge notifications are parsed from the title/body. **Bug fixed 2026-10-01:** before this fallback, ratings made before the patch was run never popped up.
- Patch also notifies on a *changed* rating (score or review differs) — "X updated their rating of you to 8/10" (`data.updated = true`, popup says UPDATED RATING); unchanged re-saves stay silent.
- `new_badge` → celebration card.
- Patch redefines `submit_rating()` (identical logic) so `new_rating`/`new_badge` notifications include `rating_id`/`badge` + `rate_kind/rate_id/rate_name/sport`. Foreground push banners suppressed for these types too.

## Match day: ready popups + players record scores (2026-10-01) — `lib/db/patch_matchday.sql` ⚠️ first version run 2026-10-01; UPDATED version must be RE-RUN

- `starts_on date` on tournaments + matches (app sends it; triggers parse "Sat, Oct 12, 2026[ at 5:00 PM]" via `fn_parse_event_date`; backfilled).
- READY: `ready_at` + triggers on `tournament_registrations` / `match_players` → once per event, `event_ready` notifications to `fn_event_people` / `fn_match_people` (sign-ups, members of signed-up teams, organiser; no demo). Threshold: tournament/league = `min_participants`, match event = `max_participants`, Organize Match = `max_players`. Already-ready events marked silently by the patch. `event_ready_acks` + `ack_ready()`; popup "READY FOR MATCH DAY?" → I'm ready / View event / Later (skipped if already acked or finished).
- **Reminder (update):** the ready popup is driven by `my_pending_ready()` (ready, not confirmed, not snoozed, not finished, match day not passed), checked on app start/foreground and when an `event_ready` notification arrives — it keeps coming back until "I'm ready" (`ack_ready`, which also clears the snooze + marks alerts read). "Remind me later" / closing → `snooze_ready` (12 h, or until match day). Table `event_ready_snoozes`.
- **Who won (update):** pickup scores need an outcome from the recorder's side (`won`/`lost`/`draw`) → `result_outcome` + `result_summary` ("Aneeq won" for 1v1, "Aneeq’s side won" otherwise; `fn_result_summary`). RPCs are now `record_event_result/record_pickup_result(id, score, note, outcome)` (old 3-arg versions dropped). Bracket sheet labels "X (you) won".
- **Everyone alerted (update):** every recorded result (organiser too, brackets + pickup) sends `match_result` to all `fn_event_people`/`fn_match_people` except the recorder → in-app popup + phone push.
- Scores: `record_match_result` now allows the two sides, any entrant after `starts_on`, organiser; non-organiser results notify organiser + sides (`match_result`). `start_tournament` allows any entrant after `starts_on`. `record_event_result` (type 'match') / `record_pickup_result` (matches): any player once match day (or full line-up if no date) → status completed, `result_score/note/by/at`, `match_result` to everyone else.
- UI: `components/MatchDayPanel.tsx` on the event page + My Turf match details; My Turf cards show "🏆 Final: …" / "✏️ Played? Record the score" / "📣 Ready for match day"; event page lets sides/entrants tap bracket games, entrant "start" after match day. Notification `match_id` taps → My Turf.
- Tested with `lib/db/testing/replay.sh` (dates, once-only announcement, acks, side/entrant/organiser permissions before/after date, pickup scores, re-run).

## Match history + automatic W/L (2026-10-01) — `lib/db/patch_match_history.sql` ⚠️ NOT YET RUN (run AFTER re-running patch_matchday.sql)

- `fn_match_history(user)` (derived from results, no stored tally → corrections never double count): challenges (team → all members), tournament/league games (team entries → all members; byes skipped), pickup events + Organize Match (recorder's outcome; 1-v-1 opponent gets the opposite; bigger games → 'played').
- RPCs `match_history(user, limit)`, `verified_record(user)` gated by `fn_can_view_profile` (mirrors profiles_select).
- Displayed per-sport stats = manual `player_stats` + verified (Profile tab + PlayerProfileModal, "N verified" pill, "Match history ›"). Record Stats modal now says only add games played elsewhere. Detailed stats (goals, aces…) stay manual.
- `profiles.stats` matches/wins kept = manual + verified by triggers (`fn_refresh_profile_stats`; demo excluded; backfilled) → headline, Hood cards, ranking.
- `app/match-history.tsx`: sport filter, record, head-to-head (Rematch / "Settle it" → `/challenges` prefilled; ChallengeModal already explains team challenges need a captain), games by month. Profile menu "Match History".

## Progress log

| Date | What was done | Commit |
|---|---|---|
| 2026-08-03 | Venues moved to Supabase; Play to Earn registration made foolproof; tournaments moved to GTA/CAD | `0c4076c`, `143556b` |
| 2026-09-30 | My Teams, Statistics, Privacy & Security, Help & Support, persisted privacy/messaging settings, PostGIS nearby players, push notification plumbing, eas.json, supabase-js pinned | `96cd848` |
| 2026-09-30 | Tournament brackets (knockout + league), challenge matches, challenge venue picker, sport-based min/max entry rules, sign-up counter/guard RLS bug fixed | `d737d31` |
| 2026-09-30 | EAS project linked (`eas init`) — push setup started, waiting on Firebase | `57b86a5` |
| 2026-10-01 | Player/team skill ratings per sport, reviews, Bronze→Diamond badges | `c530078` |
| 2026-10-01 | Realistic team squad sizes per sport/format; nearby event alerts (push) | `c530078` |
| 2026-10-01 | Technical README.md, local SQL replay harness (`lib/db/testing`) | `757a22f` |
| 2026-10-01 | First-run sports setup (welcome flow), sport editor on Profile | `c17f8f9` |
| 2026-10-01 | Challenge popups (new + accepted/declined/called off/result), rating requests | `ba743de` |
| 2026-10-01 | Rating popups (request, new/updated rating, badge), fix for missing rated-you alert | `199b783` |
| 2026-10-01 | Event alert popups, ready-for-match-day reminders, player-recorded scores, match history + auto W/L | `78f97ac` |

**SQL status:** everything up to `patch_rating_popups.sql` has been run in Supabase (2026-10-01). **Pending: `patch_matchday.sql`** — until run, creating events/matches fails (new `starts_on` column) and ready/score features don't work.

## Your to-do list (things only the owner can do)

0. **Try team formats + event alerts:** create a team (format picker, squad limits), set Nearby Event Alerts radius in Privacy & Security.
0. **Try ratings in the app:** open Daniel Park's profile (Platinum tennis), rate a demo player, rate a team as yourself / as a team you captain.

1. **Firebase for Android push (needed before the first build):**
   1. console.firebase.google.com → Create project "MatchDay".
   2. Add an **Android** app, package name `com.matchday.app` → download `google-services.json` → put it in the project root next to `app.json`.
   3. Project settings → Service accounts → **Generate new private key** → upload that JSON at expo.dev → matchday-v3 → Credentials → Android → FCM V1 service account key. Do **not** put this key in the repo.
   4. Tell Claude — it will add `android.googleServicesFile` to app.json, start `eas build --profile preview --platform android` (APK, builds on Expo's servers), and send a test push once the app is installed and signed in.
2. **iPhone push (optional):** needs a paid Apple Developer account ($99/yr). Decide whether to do iOS now or later.
3. **Codespace idle timeout:** github.com/settings/codespaces → Default idle timeout → 240 min (may only apply to new codespaces). Current codespace is 30 min.
4. **Try the new features in the app** (never clicked through by Claude — only DB-tested): create a tournament, sign up, start it, enter results; send a challenge to a demo player and record a result; pick a venue in a challenge.
5. **Later:** Stripe (Phase 5); App Store / Play Store developer accounts for submission.

## What's NOT Done Yet (Backend / Features)

- Payments / Stripe (Phase 5)
- Push: Firebase/FCM credentials + first EAS build (see to-do list); App Store / Play Store submission; Sentry/analytics (Phase 6)
- The Hood demo players/posts are still Lahore-themed (kept intentionally as dummy data)

## ⚠️ Bring up at the start of the next session (review only — NOT implemented yet)

The owner asked (2026-09-30) to be reminded of these next time and to decide before any work starts. Nothing below has been changed.

### Redundancies found
1. **Three different "match" concepts.** (a) *Organize Match* in My Turf (`matches` / `match_players` tables, `lib/matches.ts`); (b) Play to Earn events of type **"Match"** (`tournaments.type = 'match'`, "Sunday Pickup Football"); (c) **Challenges** (`challenges` table). (a) and (b) are basically the same thing (a pickup game people join). Suggest: drop the "Match" type from Play to Earn and keep Organize Match; keep Challenges as the competitive 1-v-1 / team-v-team option.
2. **Tournament lists shown in three places.** Play to Earn tab, `app/my-tournaments.tsx`, and the "My Events" section in My Turf all list the same events with three different card designs. Suggest one shared `EventCard` component, and consider making My Tournaments a filter ("Mine") on the Play to Earn tab instead of a separate screen.
3. **Two sign-up flows for events.** The Register sheet in `earn.tsx` (player events) and the Sign Up button on `app/tournament.tsx` (all events). Suggest the list's button always opens the details page, so there's one flow.
4. **Two venue pickers.** `components/LocationPickerModal.tsx` (map + list, all venues, uses mock `VENUES`) and `components/VenueList.tsx` (list, filtered by sport, uses live DB venues). Suggest one picker filtered by sport, using DB venues, with an optional map view.
5. **Stats in two places.** Profile tab stats + Record Stats vs `app/statistics.tsx`. Fine to keep both, but the Profile section could become a compact summary that links to Statistics.
6. **Repeated code (copy-pasted in many files):** the UUID check (5 files), sport→emoji maps (9 places), event type colours/labels (4 files), the confirm dialog (6 screens), the coloured back-button header (12 screens). Suggest shared `lib/constants.ts` (emoji, colours, UUID) + `components/ConfirmDialog.tsx` + `components/ScreenHeader.tsx`.
7. **Notifications created in two ways.** Some from the app (`createNotification`, 6 calls — team joins/invites, match joins, follows), some by the database (tournaments, challenges). Moving the remaining ones into DB functions would make them reliable and stop anyone faking a notification (the `notifications_insert` policy currently allows any insert).
8. **Very large screen files.** `myturf.tsx` (~1380 lines), `profile.tsx` (~1150), `index.tsx` (~1140), `book.tsx` (~1045), `earn.tsx` (~1000). Hard to maintain; split into section components.
9. **Leftover mock data shown to signed-in users.** The Hood starts with mock players/posts (Lahore-themed), Messages shows mock conversations when signed out, and mock venues are used in `LocationPickerModal`. Decide what should stay as demo content.
10. **Alert buttons that don't work on web.** `Alert.alert` with Cancel/Confirm buttons does nothing on web in `comments.tsx` (delete comment), `profile.tsx` (remove sport) and `auth/callback.tsx`. Replace with the in-app confirm dialog.

### UI / UX improvement ideas
1. **One clear home for competing.** The Play to Earn tab name is confusing now that it holds brackets and leagues; consider "Compete" with sections: Tournaments · Leagues · Challenges.
2. **Loading states:** 15 screens use a full-screen spinner; skeleton cards would feel faster.
3. **Backgrounds:** 9 screens load the grass background from pollinations.ai at runtime (slow on mobile data, and breaks if that site is down). Bundle it as a local image asset.
4. **Consistent headers and colours:** each standalone screen has its own header colour (green / purple / orange / amber / blue). Pick one header style and use colour only for accents.
5. **Empty states with a next step** everywhere (some screens have them, some just show nothing).
6. **Accessibility:** no `accessibilityLabel`s anywhere; icon-only buttons (bell, +, back) are invisible to screen readers. Also check text contrast on the grass background.
7. **Bracket on phones:** big brackets (16+) need horizontal scrolling; add pinch-zoom or a "list by round" toggle, and auto-scroll to the viewer's next match.
8. **Challenges:** show challenge wins on player profiles, add a simple leaderboard, and let people message the opponent from the challenge card.
9. **Book a venue from a challenge:** once a venue is picked, offer "Book this court" to jump straight into the booking sheet.
10. **Onboarding:** first-launch walkthrough (pick sports, allow location, allow notifications) instead of asking permissions cold.
11. **Pull-to-refresh + "last updated"** consistently on all lists; show a small banner when the app is showing demo data because the database couldn't be reached.
12. **Forms:** one date+time picker style everywhere; inline validation messages instead of pop-up alerts (Create Event still uses Alerts).
