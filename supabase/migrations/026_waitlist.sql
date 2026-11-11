-- Waitlist: a player asks to be told if a full time opens up.
--
-- One row per player per club per date and start time. When a booking at that
-- club is cancelled, released (never paid) or moved, everyone waiting for a time
-- that overlaps the freed court-time is told at once (notification + bell); the
-- first to book gets it. 'notified' waits can be told again later if the time
-- is booked and freed again (the app waits at least 30 minutes between tellings).
--
-- Safe to re-run. The app works without this table: the booking flow simply keeps
-- showing "Taken" on full times.

create table if not exists public.waitlist (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  venue_slug        text not null,
  date              date not null,
  start_time        time not null,
  duration_minutes  integer not null default 60 check (duration_minutes in (30, 60, 90, 120)),
  status            text not null default 'waiting' check (status in ('waiting', 'notified', 'cancelled')),
  notified_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- One wait per player per club, date and start time (re-joining reuses the row).
create unique index if not exists waitlist_one_per_slot
  on public.waitlist (user_id, venue_slug, date, start_time);

create index if not exists waitlist_lookup
  on public.waitlist (venue_slug, date)
  where status in ('waiting', 'notified');

alter table public.waitlist enable row level security;

-- A player can read their own waits (My bookings lists them). Nobody writes through
-- the API directly: joining, leaving and being told all go through the app's own
-- routes, which check the slot really is full and use the service role.
drop policy if exists "Players can read their own waits" on public.waitlist;
create policy "Players can read their own waits"
  on public.waitlist for select
  using (auth.uid() = user_id);
