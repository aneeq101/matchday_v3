# CLAUDE.md — matchday_v3

Auto-loaded by Claude Code at session start. Keep this current as the project evolves.

---

## What This App Is

**MatchDay** — Expo (React Native + web) sports social network and venue booking app. Players find nearby players, organise matches, join tournaments, and book sports venues. Uses real GPS. No backend yet — all data is local mock data.

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
| Styling | `StyleSheet.create` — no external UI lib |
| Primary colour | `#16a34a` (green) |

---

## File Map

```
app/
  _layout.tsx              # Root Stack + SafeAreaProvider
  (tabs)/
    _layout.tsx            # Bottom tab bar (5 tabs)
    index.tsx              # The Hood — social feed + player discovery
    myturf.tsx             # My Turf — bookings, matches, dashboard
    earn.tsx               # Play to Earn — tournaments
    book.tsx               # Book Venue — search, map, booking modal  ← main work area
    profile.tsx            # Profile + settings
  messages.tsx             # Conversation list
  chat.tsx                 # 1-on-1 chat
  my-teams.tsx / team.tsx  # Teams list + team detail
  statistics.tsx           # Aggregated player statistics
  privacy.tsx              # Privacy & Security
  help.tsx                 # Help & Support (FAQ + tickets)

components/
  BookMap.native.tsx        # react-native-maps (iOS/Android)
  BookMap.web.tsx           # react-leaflet (web)
  RadiusSlider.native.tsx   # wraps @react-native-community/slider
  RadiusSlider.web.tsx      # <input type="range"> — React 19 safe
  PlayerProfileModal.tsx    # Reusable bottom sheet

data/
  mockData.ts              # All types + data + venue helpers

hooks/
  useUserLocation.ts        # GPS: expo-location (native) / navigator.geolocation (web)

utils/
  geo.ts                   # Coord, offsetCoord, distanceKm, latDeltaForRadius, formatDistance
```

---

## Book Screen — Current State (main feature area)

`app/(tabs)/book.tsx` is where most development happens.

**Features live:**
- Search bar (name / address / sport)
- Sport filter pills: All / Football / Cricket / Tennis / Basketball / Badminton / Baseball
- Radius slider 1–20 km, syncs bidirectionally with map zoom
- List ↔ Map toggle
- Live venue search via Overpass API (OpenStreetMap) — triggers when sport filter + GPS active
- Booking modal: date, time slot, duration, sport, players, special requests
- Booking confirmed success screen

**Venue filtering rules:**
- Only venues with `coord` (absolute GPS) are shown — `offsetKm` venues are excluded
- No GPS → radius filter skipped, all real venues shown, live search disabled
- With GPS → radius filter + distance sort + live Overpass search merged in

**BOOKING_SPORTS:** `['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton', 'Baseball']`

**Currency note:** UI shows "CAD" hardcoded (fixed 2026-08-03 — was "PKR", a mislabel left over from when venues/tournaments were Lahore-based). Matches Book and Play to Earn screens, both GTA-based now.

**Map vs List venue sets (important):**
- `mapVenues` = search + sport filter only, **no radius filter** — markers never disappear when user zooms or changes radius
- `listVenues` = search + sport + radius filter — keeps the list manageable
- Both are computed in `book.tsx` from `searchSportMockVenues` (mock) + `filteredLiveVenues` (Overpass)

---

## Venue Data (`data/mockData.ts`)

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

When adding new venues: use `coord` (not `offsetKm`), prefix ID with `gta_`, set `pricePerHour: 0` for free/public courts.

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

**6 phases** across ~8 weeks. Start with `npm install @supabase/supabase-js`, create a Supabase project, run schema migrations, wire auth into `app/_layout.tsx`.

## Phase 3/4 completion (2026-09-30) — `lib/db/patch_phase4_complete.sql` run in Supabase 2026-09-30

- **My Teams** — `app/my-teams.tsx` (list + Discover + create), `app/team.tsx` (detail, add players, edit, leave/delete), `lib/teams.ts`, `components/TeamFormModal.tsx`. Tables `teams`, `team_members`; owner auto-joins as captain via trigger; `TEAM_FULL` capacity trigger; demo teams `30000000-…-00{1-3}`.
- **Statistics** — `app/statistics.tsx` + `lib/statistics.ts` (player_stats + bookings/matches/tournaments/teams/follows). Stat field defs moved to `lib/sportStats.ts`.
- **Privacy & Security** — `app/privacy.tsx` (show-in-nearby, push toggle, change password, sign out everywhere, delete account via `delete_my_account()` RPC). Profile tab Privacy & Messaging card now persists to `profiles` (`privacy`, `allow_messages`, `messages_from`) via `lib/settings.ts`; enforced server-side in `get_or_create_conversation` (raises `MESSAGES_DISABLED`) — use `openConversation()` from `lib/chatService.ts` to get a user-facing error. "Friends Only" = `privacy='private'` → visible only to people the user follows (profiles_select policy).
- **Help & Support** — `app/help.tsx` (FAQ + contact form → `support_tickets`), `lib/support.ts`.
- **Nearby players (PostGIS)** — `profiles.latitude/longitude/location` (+ sync trigger), `nearby_players(lat,lng,radius_km)` RPC; Hood saves user location and calls `fetchNearbyPlayers()`; falls back to demo players if RPC fails / nobody nearby.
- **Push notifications** — `lib/push.ts` (expo-notifications), tokens in private `push_tokens` table. DB triggers send via Expo push API using `pg_net`: every `notifications` row + every chat message. Needs `npx eas init` (EAS projectId) + a dev/production build; not supported on web or Expo Go Android.
- **Payment Methods** — intentionally still "coming soon" (Stripe deferred).
- **EAS** — `eas.json` added (development / preview APK / production). `@supabase/supabase-js` pinned to **2.105.4**: 2.106+ contains a dynamic `import()` that Hermes can't compile, which breaks release builds.

## What's NOT Done Yet (Backend / Features)

- Payments / Stripe (Phase 5)
- `npx eas init` + first EAS build, App Store / Play Store submission, Sentry/analytics (Phase 6)
- The Hood demo players/posts are still Lahore-themed (kept intentionally as dummy data)
