-- MatchDay — initial schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

-- ── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists postgis;

-- ── Profiles ────────────────────────────────────────────────────────────────
-- One row per auth user, auto-created on sign-up via trigger below
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  avatar_url  text,
  bio         text,
  area        text,
  created_at  timestamptz default now()
);

-- ── Venues ──────────────────────────────────────────────────────────────────
create table public.venues (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null,
  address        text,
  latitude       double precision,
  longitude      double precision,
  sports         text[]      default '{}',
  price_per_hour int         default 0,
  rating         numeric(2,1) default 0,
  image_color    text        default '#16a34a',
  is_verified    bool        default false,
  created_by     uuid        references public.profiles(id) on delete set null,
  created_at     timestamptz default now()
);

-- ── Bookings ────────────────────────────────────────────────────────────────
create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  venue_id         uuid        references public.venues(id) on delete set null,
  venue_name       text,       -- denormalised snapshot
  venue_address    text,
  sport            text,
  date             text,
  time_slot        text,
  duration_hours   int         default 1,
  players_count    int         default 10,
  special_requests text,
  total_price      int         default 0,
  status           text        default 'confirmed',
  created_at       timestamptz default now()
);

-- ── Row-Level Security ───────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.venues   enable row level security;
alter table public.bookings enable row level security;

-- Profiles
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- Venues: public read, authenticated write
create policy "venues: public read"      on public.venues for select using (true);
create policy "venues: auth insert"      on public.venues for insert with check (auth.role() = 'authenticated');
create policy "venues: owner update"     on public.venues for update using (auth.uid() = created_by);

-- Bookings: own rows only
create policy "bookings: own read"   on public.bookings for select using (auth.uid() = user_id);
create policy "bookings: own insert" on public.bookings for insert with check (auth.uid() = user_id);
create policy "bookings: own update" on public.bookings for update using (auth.uid() = user_id);

-- ── Auto-create profile on sign-up ──────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
