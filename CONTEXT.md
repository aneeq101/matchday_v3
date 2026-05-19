# MatchDay — Project Context

## What is MatchDay?

MatchDay is a sports social network and venue booking mobile app that works for any city globally. It lets players find other players nearby, organise matches, register for tournaments, book sports venues, and message each other — all in one place. The app uses the device's real GPS location to show venues and players relative to wherever the user actually is. The target audience is recreational and semi-professional sports players anywhere in the world.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 54 (managed workflow) |
| Routing | expo-router v6 (file-based) |
| Language | TypeScript (strict) |
| React | React 19.1.0 / React Native 0.81.5 |
| Navigation | expo-router `Tabs` + `Stack` |
| Icons | `@expo/vector-icons` — Ionicons only |
| Safe area | `react-native-safe-area-context` |
| Maps (native) | `react-native-maps` 1.20.1 |
| Maps (web) | `react-leaflet` 4.x + `leaflet` 1.9.4 |
| GPS | `expo-location` |
| Radius slider | `@react-native-community/slider` (native), custom `<input type="range">` (web) |
| Animations | `react-native-reanimated` ~4.1.1 |
| Styling | `StyleSheet.create` (no external UI lib) |
| Data | Local mock data (`data/mockData.ts`) — no backend yet |
| Primary colour | `#16a34a` (green) |

---

## Project Structure

```
matchday_v3/
├── app/
│   ├── _layout.tsx              # Root Stack layout + SafeAreaProvider
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Bottom tab bar (5 tabs)
│   │   ├── index.tsx            # The Hood
│   │   ├── myturf.tsx           # My Turf
│   │   ├── earn.tsx             # Play to Earn
│   │   ├── book.tsx             # Book Venue
│   │   └── profile.tsx          # Profile
│   ├── messages.tsx             # Messages inbox
│   └── chat.tsx                 # 1-on-1 chat screen
├── components/
│   ├── BookMap.native.tsx        # Interactive map (iOS/Android) — react-native-maps
│   ├── BookMap.web.tsx           # Interactive map (web) — react-leaflet / Leaflet.js
│   ├── RadiusSlider.native.tsx   # Slider for native (wraps @react-native-community/slider)
│   ├── RadiusSlider.web.tsx      # Slider for web (custom <input type="range"> — React 19 safe)
│   └── PlayerProfileModal.tsx    # Reusable player profile bottom sheet
├── data/
│   └── mockData.ts              # All types + mock data + helper functions
├── hooks/
│   └── useUserLocation.ts        # GPS hook: expo-location (native) / navigator.geolocation (web)
├── utils/
│   └── geo.ts                   # Coord, offsetCoord, distanceKm, latDeltaForRadius, formatDistance
├── babel.config.js              # { worklets: false, reanimated: false } to skip broken Babel plugins
├── app.json                     # Expo config; web output: "single" (prevents SSR window errors)
└── package.json
```

---

## Screens & Features

### Tab 1 — The Hood (`index.tsx`)
The main social feed and player discovery hub.

- **Post feed** — scrollable cards showing player posts (looking for teammates, skill level, sport)
- **Like / comment / share** actions on each post
- **Player avatar tap** — opens PlayerProfileModal bottom sheet
- **Players Nearby modal** — searchable list with sport filter pills; each player card expands to show Connect / Message / Invite / Create buttons
- **Create Post modal** — text input + Looking For selector + Sport selector + Skill Level selector + "Post to Feed" and "Broadcast to Nearby" buttons
- **Broadcast modal** — radius selector (1 / 3 / 5 / 10 / 15 km)
- **FAB (+) button** — opens Create Post modal; uses the football field image as its background
- **Header** — football field image with dark overlay, shows "247 Active Players" and "38 Looking Today" stat pills, links to Messages

### Tab 2 — My Turf (`myturf.tsx`)
Personal dashboard for a player's activity.

- **Stats row** — Bookings / Matches / Tournaments counts
- **Upcoming Bookings** — cards with venue, date, sport, price; tap opens booking detail bottom sheet modal
- **My Matches** — cards with opponent, result, sport emoji; tap opens match detail modal
- **Quick Actions grid** — New Booking / My Tournaments / Statistics / My Teams
- **Notification bell** — tappable icon opens a dropdown panel with recent notifications

### Tab 3 — Play to Earn (`earn.tsx`)
Tournament and event discovery.

- **Filter tabs** — All / Tournament / League / Match
- **Event cards** — sport emoji, name, date, location, entry fee, prize pool, participant progress bar
- **Register modal** — event summary, fee breakdown (entry + platform fee), total, payment note, Confirm Registration button
- **Create Event modal** — full form: name, type, sport, date, location, max participants, entry fee, prize pool, description

### Tab 4 — Book Venue (`book.tsx`)
Venue search and booking.

- **Search bar** — filters venue list in real time by name, address, or sport
- **Sport filter pills** — horizontal scrollable row (All / Football / Cricket / Tennis / Basketball / Badminton / Baseball); selecting a sport filters mock venues and triggers a live Overpass API search for real nearby venues
- **List / Map toggle** — switches between list view and interactive map
- **Radius slider** — adjusts search radius (1–20 km); syncs bidirectionally with map zoom
- **Live search status bar** — shown when a sport filter is active; displays loading spinner, result count, API error, or "enable location" prompt as appropriate
- **Venue cards** — coloured image header, star rating, address, sport tags, price per hour, Book Now button; live (Overpass) venues show a blue "Live" badge and "Contact Venue" instead of a price
- **Interactive map (native)** — `react-native-maps` MapView with:
  - Sport-specific emoji markers (⚽🏏🏀🎾🏸⚾🏟️) with venue name label
  - Tap marker → `Marker onPress` sets selected venue; floating bottom card overlay shows venue details + Book Now button (selected marker turns green)
  - Tapping map background dismisses the card
  - User location circle (green, radius-sized)
  - `onRegionChangeComplete` → updates radius slider from map zoom level
  - Centers on venue centroid (Toronto area) when no GPS
- **Interactive map (web)** — `react-leaflet` + Leaflet.js with:
  - Same emoji markers via `L.divIcon`
  - Popup with venue info and "Book Now" button
  - `MapZoomSync` component: `zoomend` event → updates radius slider; slider change → calls `map.setZoom`
  - Leaflet CSS injected from CDN at module load
  - `RecenterMap` component keeps map centered on user
- **Booking modal** — date, time slot grid, duration, sport (pre-filled from active filter), players count, special requests, total price (hidden for contact-only venues)
- **Booking Confirmed screen** — success state shown after booking

**Venue filtering rules:**
- Only venues with `coord` (real GPS) are shown — offset-based dummy venues are excluded
- When GPS unavailable: all real venues shown (no radius filter); live search disabled
- When GPS available: radius filter applied, sorted by distance; sport filter triggers live Overpass search
- Mock and live venues are merged in both list and map views; live results are deduped by index (max 30 from API)

### Tab 5 — Profile (`profile.tsx`)
User profile and settings.

- **Profile header** — football field image with dark overlay, avatar initials circle, name (Aneeq Ahmad), location (Model Town, Lahore)
- **Stats card** — overlaps header, shows Matches / Wins / Rank
- **My Sports grid** — sport cards with emoji + skill badge; dashed "Add Sport" card
- **Privacy & Messaging section**:
  - Profile Visibility (Public / Friends Only / Private) — modal with radio options
  - Allow Messages toggle (Switch)
  - Accept Messages From — modal with checkboxes (Everyone / Followers / Nobody)
- **Account Settings** — Edit Profile / Notifications / Payment Methods / Help & Support menu items
- **Logout** — confirmation modal
- **Version footer**

### Messages Inbox (`messages.tsx`)
- Conversation list with avatar, player name, gender icon (blue ♂ / pink ♀), last message preview, timestamp
- Unread indicator (blue dot + bold text)
- Search bar filters by name or message content
- Tapping a conversation navigates to Chat

### Chat Screen (`chat.tsx`)
- Green header with player avatar, name, online indicator, back button
- Message bubbles — sent (green, right-aligned) / received (white, left-aligned)
- Auto-scrolls to latest message
- Text input with attach button; send button activates when text is entered
- Conversation data keyed by conversation ID from mock data

### PlayerProfileModal (`components/PlayerProfileModal.tsx`)
Reusable bottom sheet modal used from The Hood.

- Coloured header matching the player's avatar colour
- Stats (matches, wins, rank), privacy badge, join date
- Sports & skills grid
- "Send Message" button (hidden for private profiles)

---

## Data (`data/mockData.ts`)

All data is local mock data — no API or database connected yet.

**Types:** `Player`, `Post`, `Venue`, `Tournament`, `Booking`, `MatchItem`, `Conversation`, `Message`, `Sport`, `Skill`, `Gender`, `Privacy`, `EventType`

**Venue data model:**
- `offsetKm?: { dx, dy }` — relative to user's GPS (mock venues, excluded from Book screen)
- `coord?: { latitude, longitude }` — absolute GPS (real venues, shown on map and list)
- `source?: 'mock' | 'live'` — `'live'` for Overpass API results; undefined/`'mock'` for local data
- Helper: `getVenueCoord(base, venue)` — prefers `venue.coord`, falls back to offset
- Helper: `venueDistanceKm(base, venue)` — handles both absolute and offset venues

**Live venue data (Overpass API):**
- Fetched at runtime from `https://overpass-api.de/api/interpreter` (OpenStreetMap)
- Triggered when a sport filter is selected and user location is available
- Query uses `sport=<osm-tag>` within current radius (capped at 10 km for API); returns up to 30 results
- OSM sport tag mapping: Football → `soccer`, Tennis → `tennis`, Cricket → `cricket`, Basketball → `basketball`, Badminton → `badminton`, Baseball → `baseball`
- Live venues have `pricePerHour: 0` (pricing unknown) and `source: 'live'`

**Real GPS venues (GTA Toronto area):**

| ID | Name | Sport(s) | Coords |
|----|------|---------|--------|
| t1 | Scotiabank Arena | Basketball, Hockey | 43.6435, -79.3791 |
| t2 | Rogers Centre | Baseball | 43.6414, -79.3894 |
| t3 | BMO Field | Football | 43.6335, -79.4179 |
| t4 | Sobeys Stadium | Tennis | 43.7729, -79.4988 |
| t5 | Varsity Centre | Football, Athletics | 43.6664, -79.3993 |
| t6 | Lamport Stadium | Football | 43.6412, -79.4278 |
| t7 | Toronto Cricket Club | Cricket | 43.7326, -79.4264 |
| t8 | Etobicoke Olympium | Basketball, Badminton | 43.6477, -79.5620 |
| tc1 | High Park Tennis Courts | Tennis | 43.6464, -79.4637 |
| tc2 | Trinity Bellwoods Tennis Courts | Tennis | 43.6454, -79.4218 |
| tc3 | Ramsden Park Tennis Courts | Tennis | 43.6754, -79.3907 |
| tc4 | Christie Pits Tennis Courts | Tennis | 43.6632, -79.4197 |
| tc5 | Sunnybrook Park Tennis Courts | Tennis | 43.7196, -79.3619 |

**Mock-only datasets (not shown on Book screen):**
- 5 offset-based Lahore venues (ids 1–5)
- 6 Players, 5 Posts, 4 Tournaments, 3 Bookings, 3 Matches, 4 Conversations + messages

---

## Key Technical Decisions & Fixes

### Babel config (`babel.config.js`)
`react-native-reanimated` 4.x's plugin requires `react-native-worklets/plugin` which is not installed. Both are disabled:
```js
presets: [['babel-preset-expo', { worklets: false, reanimated: false }]]
```

### Web output: `"single"` (not `"static"`)
Leaflet accesses `window` at module load time, which breaks with SSR pre-rendering. Setting `"output": "single"` in `app.json` makes Expo build a client-side SPA.

### Platform-specific map components
`react-native-maps` imports native-only modules that break Metro's web bundle. Solution: Metro resolves `BookMap.native.tsx` for iOS/Android and `BookMap.web.tsx` for web automatically.

### Platform-specific slider
`@react-native-community/slider` uses `ReactDOM.findDOMNode` (removed in React 19) on web. Solution: `RadiusSlider.native.tsx` wraps the community slider; `RadiusSlider.web.tsx` uses `<input type="range">` directly.

### Mobile marker tap — bottom card overlay (replaces Callout)
`Callout tooltip onPress` is unreliable on Android with react-native-maps (touches don't always register). Fix: removed `<Callout>` entirely. `Marker` now uses `onPress` to set a `selectedVenue` state in `BookMap.native.tsx`. A floating bottom card (absolutely positioned) renders over the map when a marker is selected, showing venue details and a Book Now button. Tapping the map background (`MapView onPress`) dismisses it. Selected marker highlights green.

### No GPS fallback — return null, not a hardcoded city
`useUserLocation` returns `null` when location permission is denied or GPS fails (no FALLBACK coordinate). All consumers already guard with `!location`, so: the radius filter is skipped (all venues shown), the map centres on the venue centroid, and the live-search bar shows "Enable location" rather than firing an API call for the wrong city.

### Mobile map — uncontrolled region + programmatic sync
`BookMap.native.tsx` uses `initialRegion` (uncontrolled) instead of `region` (controlled). The controlled prop caused the map to snap back to the calculated region on every re-render, preventing user zoom/pan. The slider and GPS location now drive the map via `mapRef.current.animateToRegion()`. Two ref flags break the feedback loop:
- `programmaticRef` — set before `animateToRegion`; suppresses the resulting `onRegionChangeComplete` so it doesn't echo back to the slider
- `mapDrivenRef` — set in `onRegionChangeComplete`; suppresses the `useEffect` from re-animating when the radius change originated from the map

### Native marker rendering (`tracksViewChanges`)
All native markers use `tracksViewChanges={true}` unconditionally. On Android, starting a custom-view marker with `tracksViewChanges={false}` can prevent it from rendering at all.

### Overpass API live venue search
When a sport filter is active and GPS is available, `book.tsx` fires a debounced (800 ms) POST to the Overpass API. The query targets `sport=<tag>` nodes and ways within the current radius. Results are mapped to the `Venue` interface (`source: 'live'`, `pricePerHour: 0`) and merged with filtered mock venues. A cancellation flag prevents stale responses from landing when the filter or location changes mid-flight.

Three endpoints are tried in order with a 12-second `AbortController` timeout each; if all fail the error banner is shown:
1. `https://overpass-api.de/api/interpreter` (primary)
2. `https://overpass.kumi.systems/api/interpreter`
3. `https://overpass.openstreetmap.ru/api/interpreter`

### Zoom ↔ Slider bidirectional sync
- **Native**: `onRegionChangeComplete` on MapView → `km = round(latitudeDelta * 111 / 2.6)` → calls `onRadiusChange`; `programmaticRef` + `mapDrivenRef` prevent feedback loops (see above)
- **Web**: `MapZoomSync` component uses `useMapEvents` (`zoomend` event) to update slider; slider prop change triggers `map.setZoom` via `useEffect` with a `programmaticRef` flag to avoid feedback loops
- **Web `RecenterMap`**: only re-centres the Leaflet map when the user's real GPS location changes; venue-list changes no longer cause the map to jump

---

## Design System

- **Primary colour:** `#16a34a` (green)
- **Background:** `#f3f4f6` (light grey)
- **Cards:** `#ffffff` with subtle shadow
- **Header image:** Unsplash football field photo with `rgba(0,0,0,0.40)` dark overlay
- **Status bar:** `translucent + transparent` — image bleeds behind it; overlay keeps system icons readable
- **Tab bar:** height accounts for Android gesture/soft-button nav bar via `useSafeAreaInsets`
- **Safe area:** `SafeAreaView` from `react-native-safe-area-context` throughout; `SafeAreaProvider` in root layout

---

## Current State

- All 5 tabs fully built and navigable
- Messages + Chat fully built
- PlayerProfileModal reusable component complete
- Interactive map working on iOS, Android, and Web
- Map markers: sport-specific emoji + venue name label — render correctly on Android (`tracksViewChanges` always true)
- Map tap → booking modal working on all platforms (native uses bottom card overlay, no Callout)
- Native map uses uncontrolled `initialRegion` + `mapRef` — user can freely zoom/pan; slider syncs bidirectionally without feedback loops
- Radius slider syncs bidirectionally with map zoom
- 13 real GPS venues in Toronto GTA area (stadiums + public tennis courts)
- Only real-GPS venues shown on Book screen (no dummy data)
- Map centres on Toronto venue centroid when no GPS available (no hardcoded fallback city)
- Google Maps API key configured in `app.json` for iOS/Android
- Sport filter pills on Book screen — filters mock venues and triggers live Overpass search
- Live nearby venue discovery via OpenStreetMap Overpass API with 3-endpoint fallback chain (no API key required)
- Live venues shown with "Live" badge; "Contact Venue" shown in place of unknown prices
- Live search status bar shows "Enable location" when GPS unavailable (not an error)
- All UI functional with mock data
- TypeScript compiles with zero errors
- Main branch: `main` on `aneeq101/matchday_v3`

---

## What Still Needs to Be Done

### Backend / Data
- [ ] Connect to a real backend (REST API or Firebase/Supabase)
- [ ] User authentication (sign up, log in, session management)
- [ ] Real-time messaging (WebSocket or Firebase Realtime DB)
- [ ] Push notifications
- [ ] Live player location / nearby player discovery
- [ ] Payment integration for venue booking and tournament entry fees

### Features
- [ ] Edit Profile screen (name, bio, avatar photo upload, sports)
- [ ] Notifications screen (in-app notification list)
- [ ] My Tournaments screen (registered events, brackets)
- [ ] Statistics screen (match history charts)
- [ ] My Teams screen (create/join teams)
- [x] User location detection (GPS with permission handling)
- [x] Radius-based venue filtering in Book tab
- [x] Radius-based player filtering in The Hood tab
- [x] Interactive map on web and mobile
- [x] Sport-specific emoji markers with venue name labels
- [x] Mobile marker tap opens booking modal (bottom card overlay, no Callout)
- [x] Map zoom ↔ slider bidirectional sync
- [x] Real GPS venues (Toronto GTA stadiums + public tennis courts)
- [x] Sport filter on Book screen (All / Football / Cricket / Tennis / Basketball / Badminton / Baseball)
- [x] Live nearby venue search via Overpass API (OpenStreetMap) — no API key required
- [ ] Post comments and shares (currently counters only, no interaction)
- [ ] Player follow / friend system
- [ ] Broadcast to Nearby — real geofenced push

### Technical
- [ ] Replace all mock data with API calls
- [ ] Add loading states and skeleton screens
- [ ] Add error handling and empty states for API failures
- [ ] Image upload for avatars and post photos
- [ ] Deep linking configuration
- [ ] App icon and splash screen design
- [ ] EAS Build setup for App Store / Play Store submission
- [ ] End-to-end and unit tests
