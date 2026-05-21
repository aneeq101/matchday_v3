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

**Currency note:** UI shows "PKR" hardcoded — known bug, not yet fixed. GTA venue prices are in CAD but displayed with PKR label.

---

## Venue Data (`data/mockData.ts`)

**Venue type fields:**
- `coord?: { latitude, longitude }` — absolute GPS → shown on map + list
- `offsetKm?: { dx, dy }` — relative to user GPS → excluded from Book screen
- `source?: 'mock' | 'live'` — `'live'` for Overpass results (shows blue "Live" badge)
- `pricePerHour: 0` + no source → "Contact Venue" shown

**Existing GTA venues with real GPS (IDs):**
- `t1`–`t8` — Major venues: Scotiabank Arena, Rogers Centre, BMO Field, Sobeys Stadium, Varsity Centre, Lamport Stadium, Toronto CC, Etobicoke Olympium
- `tc1`–`tc5` — Public tennis: High Park, Trinity Bellwoods, Ramsden Park, Christie Pits, Sunnybrook Park
- `gta_t01`–`gta_t10` — Additional public tennis courts (Riverdale, Withrow, Dufferin Grove, etc.)
- `gta_t11`–`gta_t18` — Private tennis clubs (Toronto Lawn TC, York TC, Donalda Club, etc.)
- `gta_s01`–`gta_s07` — Football/Soccer fields (Centennial Park, Downsview, Pan Am, etc.)
- `gta_c01`–`gta_c07` — Cricket grounds (Maple CC, Scarborough CA, Centennial Park, etc.)
- `gta_b01`–`gta_b06` — Basketball arenas (Mattamy Athletic Centre, Goldring, Esther Shiner, etc.)
- `gta_bd01`–`gta_bd05` — Badminton clubs (Toronto, Scarborough, Markham, Richmond Hill, Mississauga)
- `gta_bb01`–`gta_bb04` — Baseball complexes (Christie Pits, Centennial, Scarborough, Etobicoke)

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

### Native map markers — VenueMarker component
Custom markers use a `VenueMarker` component with per-marker `tracksViewChanges` state:
- Starts `true` → flips to `false` after `onLayout` fires
- Design: explicit-size (46×46) colored circle with white border + emoji inside + name bubble below
- Android: `includeFontPadding: false`, platform-specific fontSize/lineHeight
- Never use bare `tracksViewChanges` without this pattern — Android markers won't render

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

## What's NOT Done Yet (Backend / Features)

- No backend — all data is mock
- No auth (sign up / log in)
- No real-time messaging (WebSocket)
- No push notifications
- No payment integration
- Edit Profile, Notifications, My Tournaments, Statistics, My Teams screens are stubs
- Post comments/shares are counters only (no interaction)
- No player follow/friend system
- No EAS Build / App Store setup
