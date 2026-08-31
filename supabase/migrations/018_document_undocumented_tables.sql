-- ============================================================
--  Document tables that exist live but were never checked in
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- notifications, booking_splits, open_matches, open_match_players and
-- matches all exist in production today (confirmed via the generated
-- types/database.ts) and several other migrations depend on them --
-- 003_notifications_delete_rls.sql adds a policy to notifications,
-- 005_data_integrity_fixes.sql ALTERs matches and references open_matches /
-- open_match_players from accept_match_player() -- but none of them were
-- ever created by a migration in this repo. They were set up directly
-- against the database at some point and the CREATE TABLE never made it
-- into version control. Anyone rebuilding this schema from
-- supabase/migrations alone would hit a wall at 003/005 with "relation
-- does not exist".
--
-- This migration closes that gap for the current, already-provisioned
-- database: every statement below is written to be a safe no-op against
-- it (IF NOT EXISTS throughout, ENABLE ROW LEVEL SECURITY is idempotent by
-- nature). It does NOT fully restore "run 001 through 018 in order on a
-- blank database" -- 005 still runs before this file numerically and would
-- still fail on a truly from-scratch rebuild, since it ALTERs matches
-- before this migration creates it. Fixing that would mean renumbering
-- existing migration history, which is more disruptive than the problem
-- it solves. For a genuine from-scratch rebuild, run this file's CREATE
-- TABLE statements right after 001, before 003.
--
-- Column shapes below are reverse-engineered from the generated
-- types/database.ts (the closest thing to ground truth available without
-- direct database access) plus what the app's own queries and RLS-bypassing
-- functions require. RLS is enabled on each table to match how every other
-- table in this schema is locked down by default, but no policies are
-- created here -- guessing at exact policy definitions without being able
-- to verify them against the live database risks being subtly wrong in a
-- way that's worse than leaving this gap noted. The actual policies already
-- live on these tables in Supabase; export them from Dashboard → Database
-- → Policies if you want them captured in version control too.

create table if not exists public.notifications (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references public.profiles(id) on delete cascade,
  type        text not null,
  message     text not null,
  read        boolean not null default false,
  created_at  timestamptz default now() not null
);
create index if not exists notifications_user_idx on public.notifications(user_id);
alter table public.notifications enable row level security;

create table if not exists public.booking_splits (
  id                 uuid default uuid_generate_v4() primary key,
  booking_id         uuid references public.bookings(id) on delete cascade,
  invited_by         uuid references public.profiles(id) on delete set null,
  user_id            uuid references public.profiles(id) on delete set null,
  amount_nzd         numeric(8,2) not null,
  status             text not null default 'pending',
  stripe_payment_id  text,
  created_at         timestamptz default now() not null
);
create index if not exists booking_splits_booking_idx on public.booking_splits(booking_id);
create index if not exists booking_splits_user_idx on public.booking_splits(user_id);
alter table public.booking_splits enable row level security;

create table if not exists public.open_matches (
  id            uuid default uuid_generate_v4() primary key,
  booking_id    uuid references public.bookings(id) on delete cascade,
  organizer_id  uuid references public.profiles(id) on delete set null,
  venue_slug    text not null,
  court_id      uuid references public.courts(id) on delete set null,
  date          date not null,
  start_time    time not null,
  end_time      time not null,
  visibility    text not null default 'public' check (visibility in ('public', 'private')),
  match_type    text not null default 'casual' check (match_type in ('casual', 'competitive')),
  skill_min     numeric,
  skill_max     numeric,
  spots_total   integer not null default 3,
  status        text not null default 'open' check (status in ('open', 'full', 'completed', 'cancelled')),
  notes         text,
  created_at    timestamptz default now() not null
);
create index if not exists open_matches_booking_idx on public.open_matches(booking_id);
create index if not exists open_matches_venue_date_idx on public.open_matches(venue_slug, date);
alter table public.open_matches enable row level security;

create table if not exists public.open_match_players (
  id         uuid default uuid_generate_v4() primary key,
  match_id   uuid references public.open_matches(id) on delete cascade,
  player_id  uuid references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  joined_at  timestamptz default now() not null
);
create index if not exists open_match_players_match_idx on public.open_match_players(match_id);
alter table public.open_match_players enable row level security;

create table if not exists public.matches (
  id                 uuid default uuid_generate_v4() primary key,
  created_at         timestamptz default now() not null,
  booking_id         uuid references public.bookings(id) on delete set null,
  player1_id         uuid references public.profiles(id) not null,
  player2_id         uuid references public.profiles(id) not null,
  winner_id          uuid references public.profiles(id) on delete set null,
  score              text,
  notes              text,
  team1_player1_id   uuid references public.profiles(id) on delete set null,
  team1_player2_id   uuid references public.profiles(id) on delete set null,
  team2_player1_id   uuid references public.profiles(id) on delete set null,
  team2_player2_id   uuid references public.profiles(id) on delete set null,
  team1_sets         integer,
  team2_sets         integer,
  winner_team        integer,
  venue_slug         text,
  played_at          timestamptz,
  recorded_by        uuid references public.profiles(id) on delete set null,
  idempotency_key    text unique
);
create index if not exists matches_player1_idx on public.matches(player1_id);
create index if not exists matches_player2_idx on public.matches(player2_id);
alter table public.matches enable row level security;
