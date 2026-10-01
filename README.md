# MatchDay

A sports social network and venue-booking app for recreational players. Players find other players near them, organise pickup matches, sign up for tournaments and leagues, challenge players and teams, rate each other's skills, and book sports venues in the Greater Toronto Area.

One TypeScript codebase runs on **iOS, Android and the web** (Expo / React Native). The backend is **Supabase**: Postgres with PostGIS, auth, row-level security, realtime and storage. Most business rules live in the database as triggers and RPC functions.

---

## Table of contents

1. [Feature overview](#1-feature-overview)
2. [Tech stack](#2-tech-stack)
3. [System architecture](#3-system-architecture)
4. [Getting started](#4-getting-started)
5. [Project structure](#5-project-structure)
6. [App architecture & conventions](#6-app-architecture--conventions)
7. [Backend: Supabase](#7-backend-supabase)
8. [Feature deep dives](#8-feature-deep-dives)
9. [Business rules reference](#9-business-rules-reference)
10. [Database migrations & testing SQL](#10-database-migrations--testing-sql)
11. [Builds & deployment](#11-builds--deployment)
12. [Critical technical decisions & gotchas](#12-critical-technical-decisions--gotchas)
13. [Security model](#13-security-model)
14. [Project status & roadmap](#14-project-status--roadmap)
15. [How to add things (recipes)](#15-how-to-add-things-recipes)

---

## 1. Feature overview

The app has five bottom tabs plus a set of stacked screens.

| Area | What it does |
|---|---|
| **The Hood** (tab) | Social feed (posts with photos/video, likes, comments) and **nearby players** found by GPS + PostGIS. |
| **My Turf** (tab) | Your bookings, matches you organised or joined, open matches near you, your events, quick actions. |
| **Play to Earn** (tab) | Tournaments (knockout brackets), leagues (round-robin tables), and pickup matches. Create, sign up, run results. |
| **Book** (tab) | Venue search with a map (native maps / Leaflet on web), sport filter, radius slider, booking sheet. |
| **Profile** (tab) | Your sports and skill levels, stats, privacy & messaging settings, menu. |
| Welcome (first run) | Pick the sports you play, optionally add level, position and a quick self-rating per sport. Skippable, shown once. |
| Messages / Chat | 1-on-1 conversations, live updates via Supabase Realtime. |
| Notifications | In-app list; every notification is also sent as a phone push. Challenges, rating requests, new ratings, badges and nearby events also **pop up** over the app. |
| Teams | Create/join teams with sport-specific squad sizes and formats, captain tools. |
| Challenges | Player vs player or team vs team challenge matches, with results. New challenges and every change to them (accepted, declined, called off, result) **pop up in-app**. |
| Ratings & badges | Rate players/teams per sport (overall + skills + conduct), reviews, Bronze to Diamond badges. Players (and captains) can **ask people they've played with to rate them**. |
| Nearby event alerts | Push alerts about new tournaments, leagues and paid matches near you, for your sports. |
| Statistics | Aggregated player stats. |
| Privacy & Security | Nearby visibility, push, event alerts + radius, password, sign out everywhere, delete account. |
| Help & Support | FAQ and support tickets. |

Currency is **CAD** throughout. Venues and demo events are in the GTA.

---

## 2. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Expo SDK 54**, managed workflow | `newArchEnabled: true` |
| Language | **TypeScript** (strict) | `tsconfig.json` extends `expo/tsconfig.base` |
| UI runtime | React 19.1.0 / React Native 0.81.5 / react-native-web 0.21 | |
| Routing | **expo-router v6** (file-based) | Typed routes on (`experiments.typedRoutes`) |
| Styling | `StyleSheet.create` only | No UI kit. Primary colour `#16a34a` |
| Icons | `@expo/vector-icons`, **Ionicons only** | |
| Maps | `react-native-maps` 1.20.1 (native), `react-leaflet` 4 + `leaflet` 1.9.4 (web) | Platform-split components |
| Location | `expo-location` (native), `navigator.geolocation` (web) | `hooks/useUserLocation.ts` |
| Media | `expo-image-picker`, `expo-video`, `expo-file-system` | Post photos/videos |
| Auth helpers | `expo-auth-session`, `expo-web-browser`, `expo-secure-store` | Google OAuth (PKCE) |
| Push | `expo-notifications` + `expo-device` | Sent server-side via Expo Push API |
| Backend | **Supabase**: Postgres 15 + **PostGIS**, Auth, RLS, RPC, Realtime, Storage, `pg_net` | |
| Supabase client | `@supabase/supabase-js` **pinned to 2.105.4** | 2.106+ breaks Hermes release builds (see §12) |
| Builds | **EAS Build** (`eas.json`) | Project `@aneeq101/matchday-v3` |
| External APIs | Expo Push API, Overpass API (OpenStreetMap, currently switched off), Google Maps SDK (Android/iOS map tiles) | |

---

## 3. System architecture

```
┌─────────────────────────────── Client (one codebase) ───────────────────────────────┐
│  iOS / Android (Hermes)            Web (single-page app, Metro web bundle)         │
│                                                                                     │
│  app/  (expo-router screens) ──► components/ (UI)                                   │
│        │                                                                            │
│        ▼                                                                            │
│  lib/  service layer ─ the ONLY place that talks to Supabase                        │
│        │  pure rule modules: sportRules.ts, ratingRules.ts, bracket.ts (no I/O)     │
│        │  data/mockData.ts  → fallback data when the DB can't be reached            │
└────────┼────────────────────────────────────────────────────────────────────────────┘
         │ HTTPS (PostgREST / RPC)   WebSocket (Realtime)   Storage (HTTPS)
         ▼
┌──────────────────────────────── Supabase project ───────────────────────────────────┐
│  Auth (email/password, Google OAuth PKCE) ──► auth.users ──trigger──► profiles      │
│                                                                                     │
│  Postgres + PostGIS                                                                 │
│   • tables with Row-Level Security (RLS) on every table                             │
│   • SECURITY DEFINER RPCs for multi-step / privileged writes                        │
│   • triggers: counters, capacity guards, validation, geo sync, notifications        │
│   • notifications INSERT ──trigger──► send_expo_push() ──pg_net──► Expo Push API    │
│                                                                    │                │
│  Realtime: postgres_changes on `messages` (chat)                   ▼                │
│  Storage: public bucket `post-media`                       FCM (Android) / APNs     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

There is no custom server. Logic that must be trusted (capacity, permissions, badges, notifications, brackets advancing) runs inside Postgres. The client only renders and calls the service layer.

---

## 4. Getting started

### Prerequisites
- Node.js 20+ and npm
- A Supabase project (or access to the existing one)
- Optional: Expo Go on a phone, an Android emulator / iOS simulator, Docker (for testing SQL), an Expo account (for EAS builds)

### Setup
```bash
npm install
cp .env.example .env      # then fill in the two values below
```

`.env` (public client values; `EXPO_PUBLIC_*` vars are inlined into the bundle at build time):
```
EXPO_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### Database (new Supabase project only)
Run the SQL files in Supabase → SQL Editor in the order listed in [§10](#10-database-migrations--testing-sql). Every patch is idempotent and wrapped in a transaction. The existing project already has all of them.

### Run
```bash
npm run web        # web at http://localhost:8081
npm start          # Metro + QR code for Expo Go
npm run android    # Android emulator / device
npm run ios        # iOS simulator (macOS)
npx expo start --tunnel   # phone not on the same network (e.g. from a Codespace)
```

Checks used during development (there is no test runner yet):
```bash
npx tsc --noEmit                                   # type-check (strict)
npx expo export --platform web     --output-dir /tmp/web   # verifies the web bundle
npx expo export --platform android --output-dir /tmp/and   # verifies the Hermes bundle compiles
```

> Typed routes: after adding a new screen, run `npx expo start` once so `.expo/types/router.d.ts` is regenerated, or `tsc` will reject `router.push('/new-screen')`.

### Google sign-in configuration (Supabase dashboard → Auth → URL configuration)
Redirect URLs must include `matchday://auth/callback`, `exp://**` (Expo Go tunnels change every session), `http://localhost:8081/auth/callback` and your web origin + `/auth/callback`.

---

## 5. Project structure

```
app/                         expo-router screens (file name = route)
  _layout.tsx                Root Stack, AuthProvider, auth gate (redirects), push registration + tap routing
  (auth)/sign-in.tsx         Email/password + Google sign-in
  (auth)/sign-up.tsx
  auth/callback.tsx          OAuth redirect handler (Android fallback path)
  (tabs)/_layout.tsx         Bottom tab bar (5 tabs)
  (tabs)/index.tsx           The Hood — feed + nearby players
  (tabs)/myturf.tsx          My Turf — bookings, matches, events, quick actions
  (tabs)/earn.tsx            Play to Earn — tournaments / leagues / matches, Create Event
  (tabs)/book.tsx            Book Venue — search, map, booking modal
  (tabs)/profile.tsx         Profile, sports & stats, privacy & messaging, menu
  messages.tsx, chat.tsx     Inbox, 1-on-1 chat (Realtime)
  comments.tsx               Post comments
  notifications.tsx          Notification list (tap → team / tournament / challenges / ratings / messages)
  followers.tsx              Followers / following
  looking-now.tsx            Players looking for a game now
  edit-profile.tsx           Name, bio, area, avatar
  my-teams.tsx, team.tsx     Team list/discover/create; team detail, members, ratings
  my-tournaments.tsx         Events I organise / joined
  tournament.tsx             Event detail: sign-ups, bracket / league table, organiser results
  challenges.tsx             Challenges (create, respond, record result)
  ratings.tsx                All ratings & reviews for a player/team
  match-history.tsx          A player's recorded games, head-to-head + Rematch (?userId=&name=&sport=)
  welcome.tsx                First-run sports setup (shown once; Profile → "Set up my sports" re-opens it)
  statistics.tsx, privacy.tsx, help.tsx

components/
  BookMap.native.tsx / .web.tsx          Venue map (react-native-maps / react-leaflet)
  RadiusSlider.native.tsx / .web.tsx     Slider / <input type="range">
  DatePickerField.native.tsx / .web.tsx  Date picker
  *.d.ts                                 Shared prop types for the platform-split components
  LocationPickerModal.tsx  Venue picker (map + list) for events/bookings; returns name + coordinates
  VenueList.tsx            Sport-filtered venue list (challenge "Where")
  PlayerProfileModal.tsx   Player sheet: follow, message, challenge, badges, ratings
  TeamFormModal.tsx        Create/edit team (sport → format → squad size)
  BracketView.tsx          Knockout bracket drawing
  ChallengeModal.tsx       New challenge sheet
  InAppPopups.tsx          All in-app popups: challenges + updates, rating requests, new ratings, badges, nearby events, ready-for-match-day, results (mounted in app/_layout.tsx)
  MatchDayPanel.tsx        Event page / Organize Match: who's ready, "I'm ready", final score + "Record final score"
  AskRatingsModal.tsx      Ask people you've played with to rate you / your team
  RatingsSection.tsx       Ratings summary, badge progress, skill bars, reviews
  RateModal.tsx            Rate a player/team
  BadgeChip.tsx            Bronze/Silver/Gold/Platinum/Diamond pill
  SportDetailsEditor.tsx   Level + position fields + optional self-rating for one sport
  NotifBell.tsx            Bell with unread count

lib/                       Service layer (Supabase calls) + pure rule modules
  supabase.ts              Client (PKCE, SecureStore session on native) + exchangeOnce()
  AuthContext.tsx          Session provider, useAuth()
  players.ts profile.ts follows.ts settings.ts statistics.ts sportStats.ts
  posts.ts comments.ts chatService.ts notifications.ts push.ts support.ts
  venues.ts matches.ts teams.ts tournaments.ts challenges.ts ratings.ts ratingRequests.ts
  matchday.ts              Ready confirmations, final scores, match-day date helpers
  history.ts               match_history / verified_record RPCs, rivalsFrom() head-to-head
  bracket.ts               PURE: knockout with byes, round robin, standings, round names
  sportRules.ts            PURE: match formats, booking limits, event entry rules, team squad formats
  ratingRules.ts           PURE: 1–10 level scale, NTRP map, skills per sport, badge tiers
  sportProfile.ts          PURE: profile sports, skill levels, per-sport fields, self-rating skills
  onboarding.ts            When to show the welcome flow (auth user_metadata.onboarding_done)
  db/*.sql                 Database migrations ("patches"), applied by hand in Supabase
  db/testing/              Local replay harness (Supabase stubs + script)

data/mockData.ts           Types + mock players/posts/venues (fallback & demo content)
hooks/useUserLocation.ts   GPS hook (null when permission is denied, no fake fallback)
utils/geo.ts               Coord helpers: distanceKm, offsetCoord, latDeltaForRadius, formatDistance
supabase/schema.sql        The original initial schema (first migration)
assets/                    Images (sport icons)
app.json / eas.json        Expo + EAS configuration
babel.config.js            babel-preset-expo with reanimated/worklets plugins disabled
CLAUDE.md                  Running engineering notes / decisions log (kept current)
PLAN.md, CONTEXT.md        Original product plan and early context (partly historical)
```

---

## 6. App architecture & conventions

### Screens never call Supabase directly
Every read/write goes through a function in `lib/*.ts`. Service functions:
- map snake_case rows to camelCase TypeScript types (`rowToTeam`, `dbToPlayer`, …),
- translate database error codes into user-facing messages (`friendlyError()` in `teams.ts`, `challenges.ts`, `ratings.ts` …),
- return safe values on failure (`[]`, `null`, `{ ok: false, error }`) instead of throwing.

### Mock-first, database-second
Screens render local data from `data/mockData.ts` immediately, then replace it with database data. If the database is unreachable or returns nothing, the mock data stays (e.g. `fetchPlayers()` returns `PLAYERS`). Demo content therefore looks the same whether it came from the DB or the fallback. When wiring a new table, verify a live round-trip (change a row in the DB, see it in the app).

Mock player ids `'1'`–`'6'` map to the demo accounts `00000000-0000-0000-0000-00000000000{1-6}` via `resolvePlayerId()` in `lib/profile.ts`.

### Pure rule modules
Rules that both the UI and the database need live in pure TypeScript modules with **mirrors in SQL**:

| TS module | SQL mirror | Keep in step |
|---|---|---|
| `sportRules.ts` `eventRules()` | `fn_tournaments_validate()` | min 4 entrants, entry type |
| `sportRules.ts` `TEAM_FORMATS` | `fn_team_formats()` | squad size per format |
| `ratingRules.ts` `BADGE_TIERS` | `fn_rating_tiers()` | badge thresholds |
| `bracket.ts` | `start_tournament()` / `record_match_result()` | bracket shape & advancement |

The database is the authority. The TS copy exists so the UI can explain rules and validate before sending.

### Platform-split components
Metro picks `Foo.native.tsx` on iOS/Android and `Foo.web.tsx` on web. A `Foo.d.ts` gives both the same props. **Never import `react-native-maps` from web code or `react-leaflet` from native code.**

### Navigation
- expo-router file routes; stacked screens are declared in `app/_layout.tsx` with `headerShown: false` (each screen draws its own header).
- Auth gate in `RootNavigator`: no session → `/(auth)/sign-in`; session inside auth flow → `/(tabs)`.
- Deep-link params are passed as route params, e.g. `/ratings?kind=team&id=<uuid>&name=…`, `/challenges?kind=&opponentId=&opponentName=&sport=`, `/team?id=`, `/tournament?id=`.

### UI conventions
- `StyleSheet.create` at the bottom of each file. Colours are inline hex values. Green `#16a34a` is the primary colour, purple `#8b5cf6` is used for teams.
- Tabs use a grass background image with a dark overlay and translucent white cards.
- Confirmation dialogs are in-app `Modal`s. `Alert.alert` with buttons does **not** work on web, so use it only for simple messages.
- Validation errors are shown inline in forms where possible.

---

## 7. Backend: Supabase

### 7.1 Auth
- Email/password and **Google OAuth with PKCE** (`flowType: 'pkce'` in `lib/supabase.ts`).
- Sessions are persisted in `expo-secure-store` on native and in browser storage on web.
- Three exchange paths (mutually exclusive):
  1. iOS/Android where the auth browser returns `{type:'success', url}` → `exchangeOnce(url)` in sign-in/sign-up;
  2. Android where the redirect lands on `app/auth/callback.tsx` → `exchangeOnce(code)` there;
  3. Web → redirect back with `?code=`; `detectSessionInUrl` exchanges automatically.
- `exchangeOnce()` de-duplicates code exchanges (a PKCE code can only be used once).
- Trigger `on_auth_user_created` (→ `fn_handle_new_user`) creates the `profiles` row for every new auth user.

### 7.2 Tables

| Table | Purpose / key columns |
|---|---|
| `profiles` | One per user (`id` = auth user id). name, initials, avatar, bio, area, gender, `privacy` ('public' / 'private' = Friends Only), `is_demo`, `stats` jsonb, messaging settings (`allow_messages`, `messages_from`), `show_in_nearby`, `push_enabled`, `event_alerts`, `event_alert_radius_km`, `latitude/longitude` + PostGIS `location`, `location_updated_at` |
| `profile_sports` | Sports a player plays + skill level (unique index on profile_id+sport) |
| `player_stats` | Per-sport W/L/D + sport-specific stats jsonb |
| `follows` | follower_id → following_id |
| `posts`, `post_likes`, `post_comments` | Feed; like/comment counts maintained by triggers |
| `conversations`, `conversation_participants`, `messages` | Chat; `get_or_create_conversation` enforces messaging privacy |
| `notifications` | In-app notifications (`type`, `title`, `body`, `data` jsonb, `read`); each insert also sends a push |
| `push_tokens` | Expo push token per user (private: owner-only RLS) |
| `venues` | Bookable venues (name, address, lat/lng, `sports[]`, `price_per_hour`, `external_id` = mock id) |
| `bookings` | Venue bookings |
| `matches`, `match_players` | Organise Match pickup games; slot count maintained by trigger, creator auto-joins |
| `tournaments` | Events: `type` ('tournament' knockout / 'league' / 'match'), sport, `format`, `entrant_type` ('player'/'team'), min/max participants, fee, prize, `status` ('active' → 'in_progress' → 'completed'), `champion_name`, `latitude/longitude/geo` |
| `tournament_registrations` | Sign-ups (`team_id` for team events) |
| `tournament_matches` | Bracket / fixtures (round, slot, a/b sides, winner, score, status) |
| `teams`, `team_members` | Teams (sport, `format`, `max_members`, `member_count`, `is_open`, `owner_id` = captain) |
| `challenges` | Player/team challenges (pending → accepted/declined/cancelled → completed); `opponent_seen_at` = popup already shown |
| `ratings` | Skill ratings & reviews (see §8.9) |
| `rating_requests` | "Please rate me" requests: requester, subject (player/team), sport, asked person, note, status pending/done/declined |
| `support_tickets` | Help & Support contact form |

### 7.3 RPC functions (called from the app via `supabase.rpc`)

| Function | Used by | What it does |
|---|---|---|
| `nearby_players(lat,lng,radius_km)` | `players.ts` | PostGIS radius search, nearest first, respects `show_in_nearby` + profile visibility |
| `get_or_create_conversation` | `chatService.ts` | Opens a DM; raises `MESSAGES_DISABLED` per recipient settings |
| `get_my_conversations`, `mark_conversation_read` | `chatService.ts` | Inbox with unread counts |
| `get_my_ranking` | `profile.ts` | The player's rank shown on profiles |
| `start_tournament(id, matches jsonb)` | `tournaments.ts` | Organiser closes sign-ups, saves the draw generated by `bracket.ts`, notifies entrants |
| `record_match_result(...)` | `tournaments.ts` | Organiser records result; knockout winners advance; completes event & sets champion |
| `create_challenge` / `respond_challenge` / `cancel_challenge` / `record_challenge_result` | `challenges.ts` | Challenge lifecycle + notifications (demo opponents auto-accept) |
| `submit_rating(...)` | `ratings.ts` | Validates & upserts a rating, computes "played together", notifies, detects new badge |
| `rating_summary(kind, id)` | `ratings.ts` | Per-sport average, badge, per-tier counts, skill averages, conduct |
| `mark_challenge_seen(id)` | `challenges.ts` | "Decide later" on the challenge popup |
| `request_ratings(...)` / `decline_rating_request(id)` | `ratingRequests.ts` | Ask people to rate you/your team (max 10 per send, 20/day, not the same person twice in 30 days) / "Not now" |
| `rating_request_suggestions(kind, id, sport)` | `ratingRequests.ts` | Who to ask: played together → teammates → follows |
| `delete_my_account()` | `settings.ts` | Deletes the caller's account and data |

### 7.4 Triggers

| Trigger | Table | Function / purpose |
|---|---|---|
| `on_auth_user_created` | auth.users | create profile |
| `trg_profiles_sync_location` | profiles | lat/lng → PostGIS `location` |
| `trg_post_likes_count`, `trg_post_comments_count` | post_likes / post_comments | counters |
| `trg_conversation_last_message`, `trg_push_new_message` | messages | inbox preview; push to other participant |
| `trg_send_push_on_notification` | notifications | every notification → Expo push |
| `auto_join_creator_trigger`, `match_player_count_trigger` | matches / match_players | creator joins; slot count |
| `trg_tournament_capacity_guard` | tournament_registrations | open + not full + team captain checks (SECURITY DEFINER) |
| `trg_tournament_participants` | tournament_registrations | participants_count |
| `trg_tournaments_validate` | tournaments | entry rules (min 4, singles/doubles/teams) |
| `trg_tournaments_sync_geo` | tournaments | event coordinates (from app, else venue-name match) → `geo` |
| `trg_alert_nearby_event` | tournaments | nearby event alerts (§8.11) |
| `trg_team_owner_autojoin` | teams | captain joins own team |
| `trg_teams_validate_size` | teams | squad size must fit the sport format |
| `trg_team_members_capacity`, `trg_team_members_count` | team_members | `TEAM_FULL`; member_count |
| `trg_ratings_complete_requests` | ratings | a rating completes the matching rating request |
| `trg_rating_requests_team_deleted` | teams | remove a deleted team's rating requests |

### 7.5 Realtime
Chat subscribes to `postgres_changes` INSERTs on `messages` filtered by `conversation_id` (`subscribeToMessages()` in `lib/chatService.ts`). The popup manager subscribes to INSERTs on `challenges` filtered by `opponent_user_id` (`subscribeToIncomingChallenges()`) and on `notifications` filtered by `user_id` (`subscribeToPopupNotifs()`, types in `POPUP_TYPES`). `messages`, `challenges` and `notifications` are in the `supabase_realtime` publication. Realtime respects RLS.

### 7.6 Storage
Public bucket **`post-media`** holds post photos/videos (uploaded from `lib/posts.ts`, served by public URL).

### 7.7 Push notifications pipeline
1. On sign-in, `registerForPush(userId)` (`lib/push.ts`) asks permission, gets an Expo push token using the EAS `projectId` from `app.json`, and stores it in `push_tokens`. Skipped on web and Expo Go Android.
2. Any row inserted into `notifications`, from a trigger, an RPC, or the app, fires `trg_send_push_on_notification` → `send_expo_push()`. That function reads the token, checks `profiles.push_enabled`, and POSTs to `https://exp.host/--/api/v2/push/send` using **`pg_net`** (async; a failure never blocks the insert).
3. Expo forwards to FCM (Android) / APNs (iOS).
4. Tapping a push runs the handler in `app/_layout.tsx`, which routes by `data`: `team_id` → team, `tournament_id` → event, `challenge_id` → challenges, `rating_player_id` → ratings, `new_message` → inbox.

Delivery to real phones needs FCM credentials (`google-services.json` + FCM key uploaded to Expo) and an EAS build. See §14.

---

## 8. Feature deep dives

### 8.1 Venues & booking (`app/(tabs)/book.tsx`)
- Venues come from the `venues` table (`fetchVenues()`), with mock `VENUES` shown first / used as fallback. 89 GTA venues are seeded (mock id kept in `external_id`).
- Only venues with absolute `coord` are shown.
- **Map vs list:** `mapVenues` = search + sport filter (no radius, so markers never disappear when zooming); `listVenues` = search + sport + radius (1–20 km slider, synced both ways with map zoom).
- Without GPS: no radius filter, map centres on the venue centroid.
- Overpass (OpenStreetMap) live search exists but is switched off: `LIVE_SEARCH_ENABLED = false`. When on, it is debounced 800 ms, uses 3 fallback endpoints, a 12 s timeout each and returns at most 30 results.
- Native markers and web map: see §12.

### 8.2 Nearby players (The Hood)
The Hood saves the user's location (`saveMyLocation`) whenever GPS is available, then calls `nearby_players()`. Players with `show_in_nearby = false` are hidden from search, but their location is still used for event alerts. If the RPC fails or no one is nearby, the screen falls back to demo players.

### 8.3 Social feed, comments, follows
Posts with optional media (Storage), likes/comments with trigger-maintained counters, follow graph. "Friends Only" profiles (`privacy='private'`) are visible only to people they follow (`profiles_select` policy).

### 8.4 Messaging
`openConversation()` → `get_or_create_conversation` RPC, which enforces `allow_messages` and `messages_from` (by gender). Realtime pushes new messages into the open chat, and a trigger sends a phone push to the other participant.

### 8.5 Organise Match (My Turf)
`matches` + `match_players`. Format rules come from `SPORT_FORMATS` (e.g. Football 5v5 = 10 players). The creator auto-joins, and a trigger keeps the current player count.

### 8.6 Events: tournaments, leagues, matches (`earn.tsx`, `tournament.tsx`)
- **Types:** `tournament` = knockout bracket, `league` = round robin (3 pts win / 1 draw), `match` = sign-up list only (needs the full line-up).
- **Category** (`tournaments.category`, `lib/db/patch_event_category.sql`):
  - `friendly`: no entry fee, no prize; the money fields are hidden in Create Event.
  - `prize`: prize pool required, entry fee optional.
  - **Enforced:** trigger `trg_tournaments_category` checks it on save; new events saved with money but no category become `prize`.
  - **In the app:** `eventCategory()` / `CATEGORY_INFO` in `lib/tournaments.ts`, plus badges and a Friendly / Prize filter in Play to Earn.
  - **Nearby alerts:** single matches alert only when they're `prize`.
  - **Also on Organize Match and venue bookings:** `matches` and `bookings` have the same `category` / `entry_fee` / `prize_pool` columns and trigger. All three forms use `components/CategoryPicker.tsx`, and `categoryMoney()` validates the input.
- **Entry rules** (`eventRules()`; DB `trg_tournaments_validate`): knockouts/leagues need ≥ 4 entrants. Tennis/Badminton singles → players; doubles → pairs (2-player teams, the captain signs the pair up); other sports → teams.
- **Lifecycle:** `active` (sign-ups open) → organiser taps Start → the app shuffles and generates the draw (`lib/bracket.ts`: byes for non-powers of two, round-robin fixtures) → `start_tournament()` saves `tournament_matches` → `in_progress` → `record_match_result()` per match. Knockout winners auto-advance, and a knockout result can't be edited once the next round is played. The event becomes `completed` with `champion_name`.
- `tournament_matches` has no client write policies; changes only happen through the RPCs.
- The event location is picked with `LocationPickerModal`, which passes venue coordinates so the event can trigger nearby alerts.

### 8.6b Match day: ready confirmations & recording scores (`lib/db/patch_matchday.sql`)
- **Dates:** `tournaments.starts_on` / `matches.starts_on` (date) are sent by the app on create and parsed from the date text by triggers (`fn_parse_event_date`), so "has match day arrived?" can be checked.
- **READY FOR MATCH DAY?**
  - **When:** the moment an event has what it needs, it's announced once (`ready_at`):
    - tournaments and leagues: the minimum number of entrants;
    - pickup "match" events and Organize Match games: a full line-up.
  - **Who:** everyone involved (`fn_event_people` / `fn_match_people`: sign-ups, members of signed-up teams, organiser) gets an `event_ready` notification, shown as a popup.
  - **Confirming:** `ack_ready()` stores it in `event_ready_acks`, and `MatchDayPanel` lists who has confirmed.
  - **Reminder:** the popup comes from `my_pending_ready()` (ready, not yet confirmed, not snoozed, not finished, match day not passed). It's checked on app start / foreground and when an alert arrives, and keeps coming back until "I'm ready". "Remind me later" → `snooze_ready()` (12 h, or until match day; `event_ready_snoozes`).
- **Recording scores**
  - **Tournament/league games** (`record_match_result`): the two sides (player or team captain) can record their own game; any entrant can once `starts_on` has passed; the organiser always can. Results not entered by the organiser notify the organiser and both sides (`match_result`).
  - **Starting the draw:** once match day arrives, any entrant can start it (`start_tournament`).
  - **Pickup games:** `record_event_result` / `record_pickup_result(id, score, note, outcome)` (events of type `match` / Organize Match).
    - Any player in it records who won (`won` / `lost` / `draw`, from their side) plus the score and an optional note, once match day arrives (or, with no date, once the line-up is full).
    - `result_summary` reads "Aneeq won" for 1-v-1 games, or "Aneeq’s side won" otherwise.
  - **Everyone is told:** every recorded result (brackets and pickup, including the organiser's) sends `match_result` to everyone in the event except the recorder, as an in-app popup and a phone push.

### 8.6c Match history & automatic win/loss (`lib/db/patch_match_history.sql`)
- **`fn_match_history(user)`** derives one row per game from recorded results, every time it's called (so a corrected result corrects the record):
  - **Challenges:** team challenges count for every team member.
  - **Tournament/league games:** byes are skipped; team entries count for every member.
  - **Pickup games** (event `match` / Organize Match): the recorder gets their outcome; in a 1-v-1 the other player gets the opposite; in bigger games everyone else gets `played`.
- **App RPCs:** `match_history(user, limit)` and `verified_record(user)` check `fn_can_view_profile` (same rule as `profiles_select`).
- **Profile stats per sport** = manual `player_stats` (Profile → Record Stats, now "games played elsewhere") + verified, shown with a "N verified from recorded games" pill on the Profile tab and in `PlayerProfileModal`.
- **`profiles.stats`** (headline matches/wins, Hood cards, `get_my_ranking`) is recomputed by triggers on `challenges`, `tournament_matches`, `tournaments`, `matches` and `player_stats` (`fn_refresh_profile_stats`; demo players excluded).
- **`app/match-history.tsx`:** sport filter, W/L/D record, head-to-head per opponent with Rematch / "Settle it" (opens `/challenges` prefilled), and games by month. Opened from the Profile menu, the stats card, and other players' profiles.
- `tournament_matches.played_at` is stamped when a result is entered.

### 8.7 Challenges (`challenges.tsx`)
Player vs player, or captain vs another team of the same sport. Flow: create → opponent accepts/declines (demo opponents auto-accept) → either side records the result. Each step notifies the other side. "Where" uses `VenueList` (DB venues for the sport, nearest first, or a custom place).

**In-app popup** (`components/InAppPopups.tsx`, mounted in the root layout while signed in; it also shows rating popups, §8.9):
- Arrives live via Realtime, or on app start / return to foreground for challenges from the last 7 days with `opponent_seen_at` empty.
- Shows sport, date, place and message, with **Accept / Decline** (decline asks to confirm) / **Decide later** (`mark_challenge_seen`).
- After accepting it offers **Message** the challenger or **My challenges**.
- Several challenges queue one after another. Related notifications are marked read.
- **Updates** (accepted / declined / called off / result recorded) pop up for the other side. They come from unread `challenge_update` notifications (live or on start/foreground, last 7 days), and closing marks them read.
  - Several updates on one challenge collapse into one card showing its latest state.
  - Cards offer Message, My challenges, Challenge someone, or (after a result) Rate the opponent.
  - Demo auto-accepts don't pop up.
- While the app is open, push banners for `challenge`, `challenge_update`, `rating_request`, `new_rating`, `new_badge` and `nearby_event` are suppressed in `lib/push.ts`, so nothing shows twice.

### 8.8 Teams (`my-teams.tsx`, `team.tsx`, `TeamFormModal`)
- A team has a sport, a **format** and a squad size (`max_members`). The squad size must fit the format (§9.3). Tennis/Badminton teams are doubles pairs of exactly 2.
- The owner is the captain (auto-joins). Teams are open (anyone can join) or invite-only (the captain adds players). Joining a full team raises `TEAM_FULL`; shrinking below the member count raises `TEAM_TOO_SMALL`.
- The team page shows members, captain tools, Challenge this Team, and Ratings & Reviews.

### 8.9 Ratings, reviews & badges (`ratingRules.ts`, `ratings.ts`, `RatingsSection`, `RateModal`)
- **Who:** a player, or a team via its captain ("Rate as"), rates a **player or a team in one sport**. One rating per rater per target per sport; rating again updates it. You can't rate yourself or your own team, and a team can't rate its own members.
- **What:** overall level **1–10** (required) on a fixed scale (§9.4), optional per-skill levels (e.g. tennis: serve, return, forehand, backhand, volleys, overhead, topspin, slice/drops, footwork, consistency, shot selection, mental toughness), sportsmanship & reliability (1–5 stars), and a review (≤ 500 chars). Skills not seen can be skipped. Tennis also shows the matching NTRP rating.
- **Played together** (✓ on a review) is computed by `fn_played_together()`: a completed challenge or tournament match between the sides, the same team, or the same pickup match.
- **Badges** (computed only in `rating_summary()`): Bronze 5+, Silver 6+, Gold 7+, Platinum 8+, Diamond 9+. A tier is earned when **≥ 3 different people rate the overall at that level or higher AND they are ≥ half of everyone who rated that sport**. Only the last 12 months count. A person who rated both as themselves and as their team counts once (their average).
- `ratings` has no insert/update policies, so all writes go through `submit_rating()`. Authors can delete their own rating. Read access follows profile visibility.
- Notifications: `new_rating`, `new_badge`.
- **Rating requests ("vouch for my game")**, `components/AskRatingsModal.tsx`:
  - **Where to ask:** from Profile (tap a sport → "Ask players to rate my …"), the Ratings & Badges screen, or the team page (captain).
  - **Who:** suggestions come from `rating_request_suggestions` (played together → teammates → follows), plus search, with an optional note.
  - **What the asked person gets:** a `rating_request` notification. It opens `/ratings?...&rate=<sport>`, which shows a "X asked you…" banner (Rate now / Not now) and opens the rating sheet.
  - **What counts:** the resulting rating is a normal rating, so badges keep their rules (≥ 3 people, majority, 12 months).
- **Rating popups** (`InAppPopups`, from unread notifications):
  - `rating_request`: "X asked you to rate their game", with Rate now (opens `/ratings?...&rate=`) / Not now (declines) / Later.
  - `new_rating`: shows the exact rating (`data.rating_id` → `fetchRating`; older notifications are matched by time with `findRatingNear`). Sent for first ratings and for changed ones (new score or review): overall + level/NTRP, top skills, conduct, played-together, review. Offers Say thanks (chat) / All my ratings.
  - `new_badge`: celebration card with the tier.
  - `submit_rating()` notifications carry `rating_id` / `badge` + `rate_kind/rate_id/rate_name/sport` (`lib/db/patch_rating_popups.sql`).

### 8.10 Notifications
Some are inserted by DB functions (tournaments, challenges, ratings, event alerts), and some still by the app via `createNotification()` (team joins/invites, match joins, follows). Tap routing is shared by `notifications.tsx` and the push handler in `_layout.tsx`.

### 8.11 Nearby event alerts
`trg_alert_nearby_event` runs after a `tournaments` insert:
- **Events:** status `active`, and type `tournament` or `league`, or a `match` with `entry_fee > 0`.
- **Event point:** venue coordinates from the app → else a venue whose name starts the location text → else (for alerts only) the organiser's location.
- **Recipients:** not demo, not the organiser, `event_alerts = true`, the sport is in their `profile_sports`, location saved within the last 90 days, and within their own `event_alert_radius_km` (5 / 10 / 25 / 50, default 25).
- **Limits:** max **3 alerts per player per 24 h**; nearest 500 per event.
- Inserts `nearby_event` notifications (`data.tournament_id`), which are pushed by the normal pipeline. Errors are swallowed, so an alert problem can never block event creation.
- Settings UI: Privacy & Security → Nearby Event Alerts.
- **In-app popup** (`InAppPopups`): "NEW NEAR YOU", showing the event name, date, place, distance, spots left, fee/prize and format, with **View & join** (→ `/tournament`) / Not interested. It only shows while sign-ups are open and spots remain; otherwise the notification is just marked read.

### 8.12 First-run sports setup (`app/welcome.tsx`)
- Opens automatically, at most once, when a signed-in user reaches the tabs with no `profile_sports` and without `user_metadata.onboarding_done`. Opening it sets that flag via `supabase.auth.updateUser`, so it never nags and works across devices with no table.
- Steps:
  1. Pick sports (multi-select). They are saved immediately with level Intermediate.
  2. One optional page per sport (`SportDetailsEditor`): level, position-type chips (`SPORT_FIELDS`), and a collapsed self-rating (`SELF_RATING_SKILLS`: Working on it / Solid / Strength).
  3. "All set" tips.
- Every step has Skip, and leaving half-way keeps what was saved.
- Data goes into `profile_sports.skill` and `details` (jsonb, label → text). Self-ratings show as a "Strengths: …" line (`summarizeDetails`) and are separate from peer ratings/badges.
- The Profile tab reuses the same editor: tap a sport to edit, use Add Sport, or "Set up my sports" when empty.

### 8.13 Privacy & account
`app/privacy.tsx` + `lib/settings.ts`: nearby visibility, push on/off, event alerts and radius, change password, sign out everywhere, delete account (`delete_my_account()`). Messaging privacy is on the Profile tab.

---

## 9. Business rules reference

### 9.1 Match formats (`SPORT_FORMATS`)
Football 3v3 / 5v5 / 6v6 / 7v7 / 8v8 / 11v11 · Cricket 5v5 / 6v6 / 8v8 / 11v11 · Tennis & Badminton singles / doubles · Basketball 3v3 / 4v4 / 5v5 · Baseball 5v5 / 7v7 / 9v9. Booking player caps: `BOOKING_MAX_PLAYERS`.

### 9.2 Event entry rules (`eventRules()`)
Minimum 4 entrants for knockouts/leagues. Maximum 64 (knockout) / 16–20 (league), varying by entrant kind. Entrant kind follows sport + format (see §8.6).

### 9.3 Team squad sizes (`TEAM_FORMATS` ⇄ `fn_team_formats()`)

| Sport | Format | Line-up | Squad min–max | Default |
|---|---|---|---|---|
| Tennis | Doubles | 2 | 2–2 | 2 |
| Badminton | Doubles | 2 | 2–2 | 2 |
| Football | 5-a-side / 7-a-side / 11-a-side | 5 / 7 / 11 | 5–10 / 7–14 / 11–25 | 8 / 10 / 18 |
| Cricket | 8-a-side / 11-a-side | 8 / 11 | 8–12 / 11–16 | 10 / 14 |
| Basketball | 3x3 / 5-on-5 | 3 / 5 | 3–4 / 5–15 | 4 / 12 |
| Baseball | 9 players | 9 | 9–20 | 14 |
| Hockey | 6 on ice | 6 | 6–22 | 15 |

### 9.4 Rating scale (`RATING_LEVELS`)
1 Beginner · 2 Novice · 3 Recreational · 4 Developing · 5 Intermediate · 6 Club · 7 Advanced · 8 Expert · 9 Elite (provincial / university / semi-pro) · 10 Pro.
Tennis NTRP equivalents: 1→1.5, 2→2.0, 3→2.5, 4→3.0, 5→3.5, 6→4.0, 7→4.5, 8→5.0, 9→5.5–6.0, 10→6.5–7.0.

### 9.5 Badges
See §8.9. Thresholds live in `BADGE_TIERS` (TS) and `fn_rating_tiers()` (SQL), and the rule itself only in `rating_summary()`.

---

## 10. Database migrations & testing SQL

There is no migration runner. Each change is a hand-written, **idempotent** SQL file in `lib/db/` (`CREATE … IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`), usually wrapped in `BEGIN … COMMIT`, and run manually in Supabase → SQL Editor.

**Order applied to the live project:**
```
supabase/schema.sql
lib/db/migration.sql
lib/db/patch_conv_rls.sql
lib/db/patch_conv_functions.sql
lib/db/patch_dedup_conversations.sql
lib/db/patch_triggers_and_inbox.sql
lib/db/patch_comments_media_sports_stats.sql
lib/db/patch_player_stats.sql
lib/db/patch_all_users_stats.sql
lib/db/patch_profile_sports_rls.sql
lib/db/patch_remove_dummy_stats.sql
lib/db/patch_media_columns.sql
lib/db/patch_matches.sql
lib/db/patch_bookings.sql
lib/db/patch_match_joining.sql
lib/db/patch_creator_autojoin.sql
lib/db/patch_earn_events.sql
lib/db/patch_social.sql
lib/db/patch_venues.sql
lib/db/patch_earn_capacity.sql
lib/db/patch_earn_tournaments_gta.sql
lib/db/patch_phase4_complete.sql
lib/db/patch_brackets_challenges.sql
lib/db/patch_event_rules.sql
lib/db/patch_ratings.sql
lib/db/patch_team_sizes_event_alerts.sql
lib/db/patch_challenge_popup.sql
lib/db/patch_rating_requests.sql
lib/db/patch_rating_popups.sql
lib/db/patch_matchday.sql
lib/db/patch_match_history.sql
lib/db/patch_event_category.sql
```

### Testing SQL locally before running it in Supabase
`lib/db/testing/replay.sh` starts a `postgis/postgis:15-3.4` Docker container, loads stand-ins for Supabase internals (`lib/db/testing/supabase_stubs.sql`: roles `anon`/`authenticated`, `auth.users`, `auth.uid()` reading `request.jwt.claim.sub`, `storage.*`, `net.http_post`), and replays every migration in order:
```bash
bash lib/db/testing/replay.sh                         # replay everything
bash lib/db/testing/replay.sh lib/db/patch_new.sql    # + your new patch
docker exec -it mdtest psql -U postgres
#   set role authenticated; set request.jwt.claim.sub = '<uuid>';   -- act as a user
docker rm -f mdtest
```
One known harmless error on replay: `patch_triggers_and_inbox.sql: cannot change return type of existing function`.

Test the patch twice (re-run safety), test as different users, and run each expected failure in its own statement.

### Rules learned the hard way
- **Trigger functions that read or update other tables under RLS must be `SECURITY DEFINER`**, otherwise RLS silently hides rows (this once broke tournament sign-up counts).
- PostgREST `upsert(..., { onConflict })` needs a unique **constraint**, not a unique index. `profile_sports` / `player_stats` use DELETE + INSERT.
- Don't rely on `.insert().select().single()` as the only source of the new row. RLS on RETURNING can yield nothing; use a separate select or an optimistic object.
- `profile_sports` has no `created_at` in the live DB. Order by `id`.
- RLS enabled with no policies means every read fails and silently falls back to mock data. Check `pg_policies` for new tables.
- Demo data: demo profiles are `00000000-…-00{1..8}` (`is_demo = true`), teams `30000000-…`, tournaments `20000000-…`. Demo users get no notifications/pushes.

---

## 11. Builds & deployment

### EAS (`eas.json`)
| Profile | Output |
|---|---|
| `development` | Dev client, internal distribution |
| `preview` | Android **APK**, internal distribution (for testing on phones) |
| `production` | Store build, `autoIncrement` version, `appVersionSource: remote` |

```bash
npx eas build --profile preview --platform android
npx eas build --profile production --platform all
npx eas submit --profile production
```
App identifiers: Android package / iOS bundle `com.matchday.app`, URL scheme `matchday`, EAS projectId in `app.json → extra.eas.projectId`.

Push on Android needs `google-services.json` in the project root, referenced by adding `"googleServicesFile": "./google-services.json"` under `android` in `app.json` (not added yet; it waits for the Firebase setup) and the FCM V1 service-account key uploaded to Expo → Credentials. **Never commit the service-account key.**

### Web
`app.json → web.output = "single"`: a client-side SPA (Leaflet touches `window` at import time, so static rendering/SSR is not possible). `npx expo export --platform web` produces a static bundle for any static host.

### Environment
Only the two `EXPO_PUBLIC_SUPABASE_*` values are required. They are public by design; security comes from RLS.

---

## 12. Critical technical decisions & gotchas

- **Babel:** `react-native-reanimated` 4 needs `react-native-worklets/plugin`, which isn't installed. Both are disabled: `presets: [['babel-preset-expo', { worklets: false, reanimated: false }]]`.
- **`@supabase/supabase-js` pinned to 2.105.4:** 2.106+ contains a dynamic `import()` that Hermes can't compile, which breaks release builds. Don't upgrade without testing an Android export.
- **Web output `single`:** see §11.
- **Native map is uncontrolled:** `MapView` uses `initialRegion`, and programmatic moves use `animateToRegion()`. Two refs prevent feedback loops: `programmaticRef` (ignore the region-change event caused by our own animation) and `mapDrivenRef` (ignore the effect re-animating after a user gesture).
- **Android invisible markers:** emoji fonts load asynchronously and shadows break the snapshot react-native-maps takes. Markers use a plain coloured circle with an ASCII sport letter, no shadow/elevation/border, and explicit `PROVIDER_GOOGLE` on Android. `tracksViewChanges` starts `true`, flips to `false` after 500 ms, and flips back to `true` for 300 ms when selection changes.
- **No `<Callout>` on native** (unreliable on Android): marker tap → floating bottom card; tapping the map dismisses it.
- **Web markers:** react-leaflet `<Tooltip>` for hover name + `<Popup>` for details/Book Now.
- **GPS:** `useUserLocation` returns `null` on permission denial. There is no fake fallback city.
- **Alerts on web:** `Alert.alert` buttons don't work on web, so use in-app modals for confirmations.
- **Auth state races:** Supabase fires `onAuthStateChange` several times at login. Profile loading uses a `loadKey` guard so a stale empty response can't overwrite good data, and never reloads right after an optimistic update.
- **Typed routes:** regenerate after adding screens (§4).

---

## 13. Security model

- **RLS on every table.** Clients use the anon key plus the user's JWT, and policies decide visibility (`auth.uid()`).
- **Privileged / multi-row operations go through `SECURITY DEFINER` functions** with explicit permission checks (organiser-only results, captain-only team actions, challenge participants, rating rules). Tables like `tournament_matches` and `ratings` have no client write policies at all.
- **Private data:** push tokens live in `push_tokens` (owner-only), not in the publicly readable `profiles`.
- **Profile visibility:** public, demo, self, or (Friends Only) people the user follows. Ratings and nearby search inherit it.
- **Known gaps to fix:** the `notifications_insert` policy currently allows any authenticated insert, so app-side `createNotification()` calls should move into DB functions. The Google Maps API key is in `app.json` (it ships in the app binary anyway), so it must stay restricted to the app's package/bundle and the Maps SDKs in Google Cloud.

---

## 14. Project status & roadmap

**Done:** auth (email + Google), bookings, social feed, messaging, matches, events with brackets and leagues, challenges, teams with realistic squad sizes, statistics, privacy & security, nearby players (PostGIS), ratings/reviews/badges, nearby event alerts, push plumbing, EAS project linked.

**Not done yet:**
- Firebase/FCM credentials + first EAS build (phone pushes); App Store / Play Store submission; Sentry/analytics.
- Payments (Stripe via Supabase Edge Functions); "Payment Methods" shows *coming soon*.
- Apple sign-in.
- Clean-ups tracked in `CLAUDE.md`:
  - overlapping match concepts, three event list designs, two venue pickers;
  - repeated constants/components (UUID check, sport emoji maps, confirm dialog, headers);
  - very large screen files;
  - app-side notifications;
  - accessibility labels, bundling the background image locally.

There are no automated tests yet. Verification is `tsc`, web/Android exports, and the local SQL replay.

---

## 15. How to add things (recipes)

**A new screen**
1. Create `app/my-screen.tsx` (default export component, own header).
2. Add `<Stack.Screen name="my-screen" options={{ headerShown: false }} />` in `app/_layout.tsx`.
3. Run `npx expo start` once to regenerate typed routes, then `npx tsc --noEmit`.

**A new table / feature backed by the database**
1. Write `lib/db/patch_<feature>.sql`: idempotent, `BEGIN…COMMIT`, RLS enabled with explicit policies, `SECURITY DEFINER` RPCs for anything that needs permission checks, `GRANT EXECUTE … TO authenticated`.
2. Add it to the order list in `lib/db/testing/replay.sh` and this README, then test with the replay harness (as several users, and run it twice).
3. Add `lib/<feature>.ts` service functions (row mappers + `friendlyError`).
4. Run the patch in Supabase and verify a live round-trip.

**A new sport**
Update every sport table together:
- `PROFILE_SPORTS`, `SPORT_EMOJI`, `SPORT_FIELDS`, `SELF_RATING_SKILLS` in `lib/sportProfile.ts`;
- `SPORT_FORMATS`, `BOOKING_MAX_PLAYERS`, `TEAM_FORMATS` (+ `fn_team_formats()`) in `lib/sportRules.ts`;
- `PLAYER_SKILLS` / `TEAM_SKILLS` in `lib/ratingRules.ts` (+ the sport list in `submit_rating()`);
- `SPORT_STAT_FIELDS` in `lib/sportStats.ts`;
- emoji maps;
- `BOOKING_SPORTS` and marker colours/letters in the Book screen and maps.

**A new venue**
Insert into the `venues` table (name, address, latitude, longitude, `sports[]`, `price_per_hour`, `external_id`) and mirror it in `data/mockData.ts` with an absolute `coord` and a `gta_` id. A venue only in mock data won't show while the DB is reachable.

**A new notification type**
Insert a `notifications` row from a DB function (preferred) with a `data` payload the tap routers understand (`team_id`, `tournament_id`, `challenge_id`, `rating_player_id`, `rating_request_id` + `rate_kind`/`rate_id`/`rate_name`/`sport`), or add a new key to both routers (`app/notifications.tsx` and `app/_layout.tsx`). The push is sent automatically.
