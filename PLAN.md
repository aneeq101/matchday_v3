# MatchDay — Backend & Feature Roadmap

## Recommended Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend-as-a-Service | **Supabase** | PostgreSQL + PostGIS for geo queries, built-in auth, row-level security, realtime subscriptions, free tier |
| Real-time messaging | **Supabase Realtime** | Postgres CDC channels, no extra service needed |
| Push notifications | **Expo Notifications + FCM/APNs** | Native Expo integration, free |
| Storage | **Supabase Storage** | Avatars, post photos; S3-compatible |
| Payments | **Stripe** | Industry standard, React Native SDK available |
| Deployment | **Supabase cloud** (managed) | Zero-ops |

> Alternative: Firebase if you prefer NoSQL. Supabase is preferred here because venue/player data is relational and PostGIS makes nearby queries trivial.

---

## Database Schema (PostgreSQL + PostGIS)

```sql
-- Core user profile
users (
  id uuid PK,           -- Supabase auth user id
  name text,
  initials text,
  avatar_url text,
  bio text,
  area text,
  gender text,
  privacy text,         -- 'public' | 'private' | 'friends_only'
  allow_messages bool,
  message_from text,    -- 'everyone' | 'followers' | 'nobody'
  location geography(Point, 4326),   -- PostGIS for geo queries
  joined_at timestamptz
)

-- Sports per user
user_sports (
  id uuid PK,
  user_id uuid FK users,
  sport text,
  skill text            -- 'Beginner' | 'Intermediate' | 'Advanced'
)

-- Venues (GTA pre-seeded + user-submitted)
venues (
  id uuid PK,
  name text,
  address text,
  location geography(Point, 4326),
  sports text[],
  price_per_hour int,
  rating numeric,
  image_color text,
  is_verified bool
)

-- Bookings
bookings (
  id uuid PK,
  user_id uuid FK users,
  venue_id uuid FK venues,
  sport text,
  date date,
  time_slot text,
  duration_hours int,
  players_count int,
  special_requests text,
  total_price int,
  status text,          -- 'pending' | 'confirmed' | 'cancelled'
  stripe_payment_intent text,
  created_at timestamptz
)

-- Social feed posts
posts (
  id uuid PK,
  user_id uuid FK users,
  text text,
  looking_for text,
  sports jsonb,
  broadcast_radius_km int,
  location geography(Point, 4326),
  likes_count int,
  comments_count int,
  created_at timestamptz
)

post_likes (
  post_id uuid FK posts,
  user_id uuid FK users,
  PRIMARY KEY (post_id, user_id)
)

post_comments (
  id uuid PK,
  post_id uuid FK posts,
  user_id uuid FK users,
  text text,
  created_at timestamptz
)

-- Player follow system
follows (
  follower_id uuid FK users,
  following_id uuid FK users,
  PRIMARY KEY (follower_id, following_id)
)

-- Teams
teams (
  id uuid PK,
  name text,
  sport text,
  captain_id uuid FK users,
  created_at timestamptz
)

team_members (
  team_id uuid FK teams,
  user_id uuid FK users,
  role text,            -- 'captain' | 'member'
  PRIMARY KEY (team_id, user_id)
)

-- Tournaments
tournaments (
  id uuid PK,
  name text,
  type text,            -- 'tournament' | 'league' | 'match'
  sport text,
  organiser_id uuid FK users,
  date date,
  location text,
  max_participants int,
  entry_fee int,
  prize_pool int,
  status text,
  stripe_product_id text
)

tournament_registrations (
  tournament_id uuid FK tournaments,
  user_id uuid FK users,
  paid bool,
  stripe_payment_intent text,
  registered_at timestamptz,
  PRIMARY KEY (tournament_id, user_id)
)

-- Messaging
conversations (
  id uuid PK,
  created_at timestamptz
)

conversation_participants (
  conversation_id uuid FK conversations,
  user_id uuid FK users,
  PRIMARY KEY (conversation_id, user_id)
)

messages (
  id uuid PK,
  conversation_id uuid FK conversations,
  sender_id uuid FK users,
  text text,
  read_at timestamptz,
  created_at timestamptz
)

-- Notifications
notifications (
  id uuid PK,
  user_id uuid FK users,
  type text,            -- 'like' | 'comment' | 'follow' | 'booking' | 'message'
  title text,
  body text,
  data jsonb,
  read bool,
  created_at timestamptz
)
```

---

## Geo Queries (PostGIS)

```sql
-- Venues within X km of a point
SELECT * FROM venues
WHERE ST_DWithin(
  location,
  ST_MakePoint(-79.38, 43.65)::geography,
  5000  -- metres
);

-- Players within X km
SELECT * FROM users
WHERE ST_DWithin(location, ST_MakePoint($lon, $lat)::geography, $metres);
```

---

## Phase 1 — Foundation (Week 1–2)

### 1a. Supabase Project Setup
- [ ] Create Supabase project
- [ ] Run schema migrations (tables above)
- [ ] Enable PostGIS extension
- [ ] Configure Row-Level Security policies
- [ ] Seed GTA venue data from `mockData.ts`
- [ ] Add `@supabase/supabase-js` to package.json
- [ ] Create `lib/supabase.ts` client singleton

### 1b. Authentication
- [ ] Install `expo-auth-session` for OAuth
- [ ] Implement sign up (email + password)
- [ ] Implement log in
- [ ] Google OAuth sign-in
- [ ] Apple Sign In (iOS)
- [ ] Auth context + session persistence
- [ ] Replace profile.tsx mock user with real auth user

### 1c. User Profile
- [ ] Create profile on first sign up
- [ ] `screens/EditProfile.tsx` — edit name, bio, sports, skill levels
- [ ] Avatar upload → Supabase Storage
- [ ] Privacy settings → saved to DB
- [ ] Update location on app open (background location permission)

---

## Phase 2 — Core Features (Week 3–4)

### 2a. Venues & Bookings
- [ ] Replace `mockData.ts` VENUES with Supabase reads
- [ ] Geo-query venues by user location + radius
- [ ] `book.tsx` booking form → writes to `bookings` table
- [ ] My Turf bookings → read from DB
- [ ] Booking status (pending → confirmed)
- [ ] Booking cancellation

### 2b. Social Feed
- [ ] Posts → Supabase reads with real-time `onSubscribe`
- [ ] Create post → writes to `posts` table with user location
- [ ] Like / unlike → `post_likes` upsert
- [ ] Comments → `post_comments` + count increment
- [ ] Feed filtered to posts within broadcast radius
- [ ] `screens/Comments.tsx` — comment thread

### 2c. Real-time Messaging
- [ ] Conversations list → Supabase Realtime subscription
- [ ] Chat screen → Realtime messages channel
- [ ] Message read receipts
- [ ] Unread count badge on tab bar

---

## Phase 3 — Social Graph (Week 5)

- [ ] Follow / unfollow players
- [ ] Followers / Following screen
- [ ] Nearby players query (PostGIS)
- [ ] Player search
- [ ] `screens/Notifications.tsx` — in-app notification list
- [ ] Push notifications (Expo Push + FCM)
  - New message
  - Someone liked your post
  - New follower
  - Booking confirmed

---

## Phase 4 — Teams & Tournaments (Week 6)

- [ ] `screens/MyTeams.tsx` — create + manage teams
- [ ] Team invite via player search
- [ ] `screens/MyTournaments.tsx` — registered events + bracket view
- [ ] Tournament registration → DB + Stripe payment
- [ ] `screens/Statistics.tsx` — match history charts (Victory Native)

---

## Phase 5 — Payments (Week 7)

- [ ] Add `@stripe/stripe-react-native`
- [ ] Stripe backend (Supabase Edge Function creates PaymentIntent)
- [ ] Venue booking payment flow
- [ ] Tournament entry fee payment flow
- [ ] Payment history in My Turf

---

## Phase 6 — Production (Week 8)

- [ ] EAS Build setup (`eas.json`)
- [ ] App icon + splash screen
- [ ] Deep linking (booking confirmation, chat)
- [ ] App Store / Play Store metadata
- [ ] Privacy policy + terms of service pages
- [ ] Analytics (PostHog or Amplitude — Expo compatible)
- [ ] Error monitoring (Sentry)
- [ ] Submit to App Store + Play Store

---

## Missing Screens to Build (App Code)

| Screen | File | Priority |
|---|---|---|
| Edit Profile | `app/edit-profile.tsx` | Phase 1 |
| Notifications | `app/notifications.tsx` | Phase 3 |
| Comments | `app/comments.tsx` | Phase 2 |
| My Teams | `app/(tabs)/teams.tsx` | Phase 4 |
| My Tournaments | `app/my-tournaments.tsx` | Phase 4 |
| Statistics | `app/statistics.tsx` | Phase 4 |
| Followers/Following | `app/followers.tsx` | Phase 3 |
| Payment flow | `app/checkout.tsx` | Phase 5 |

---

## Immediate Next Steps (This Week)

1. `npm install @supabase/supabase-js`
2. Create Supabase project at supabase.com
3. Run schema migration SQL
4. Create `lib/supabase.ts`
5. Wire auth into `app/_layout.tsx`
6. Replace `profile.tsx` mock data with real auth user
