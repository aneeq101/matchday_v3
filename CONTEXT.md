# MatchDay — Project Context

## What is MatchDay?

MatchDay is a sports social network and venue booking mobile app built for Lahore, Pakistan. It lets players find other players nearby, organise matches, register for tournaments, book sports venues, and message each other — all in one place. The target audience is recreational and semi-professional sports players in Lahore.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo SDK 54 (managed workflow) |
| Routing | expo-router v5 (file-based) |
| Language | TypeScript (strict) |
| React | React 19 / React Native 0.79.2 |
| Navigation | expo-router `Tabs` + `Stack` |
| Icons | `@expo/vector-icons` — Ionicons only |
| Safe area | `react-native-safe-area-context` 4.14.0 |
| Maps | `react-native-maps` 1.20.1 |
| Animations | `react-native-reanimated` 3.16.x |
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
│   └── PlayerProfileModal.tsx   # Reusable player profile bottom sheet
├── data/
│   └── mockData.ts              # All types + mock data
├── app.json                     # Expo config (Google Maps API key wired)
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

- **Search bar** — filters venue list in real time
- **List / Map toggle** — switches between list view and interactive map
- **Venue cards** — coloured image header, star rating, address, sport tags, price per hour, Book Now button
- **Interactive map** — `react-native-maps` MapView with:
  - All 5 venues shown as colour-coded markers
  - Tap marker → Callout shows venue name, price, and "Book Now" button that opens the booking modal
  - User location shown (default: 31.5204, 74.3587 — central Lahore)
  - Web platform shows a graceful fallback message
- **Booking modal** — date, time slot grid, duration, sport, players count, special requests, total price calculation
- **Booking Confirmed screen** — success state shown after booking

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

**Mock datasets:**
- 5 Players (mixed gender, various sports/skills, public/private)
- 4 Posts
- 5 Venues with coordinates:
  - Model Town Sports Complex — `31.4834, 74.3293`
  - Gulberg Sports Arena — `31.5176, 74.3339`
  - DHA Cricket Ground — `31.4697, 74.4077`
  - Johar Town Basketball Court — `31.4702, 74.2823`
  - Wapda Town Football Ground — `31.4469, 74.2741`
- 3 Tournaments
- 3 Bookings
- 3 My Matches
- 4 Conversations + associated chat messages

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
- Interactive map working on iOS and Android (web shows fallback)
- Google Maps API key configured in `app.json` for both platforms
- All UI is functional with mock data
- TypeScript compiles with zero errors
- Safe area and status bar handled correctly on Android (translucent status bar, soft nav buttons)
- Deployed branch: `claude/review-app-code-9OtPO` on `aneeq101/matchday_v3`

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
- [ ] Venue search with real location-based filtering
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
