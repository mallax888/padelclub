-- Weekly regulars: "same time every Thursday" for the next 4, 8 or 12 weeks.
--
-- A regular is a small record (the series) plus one ordinary booking per week
-- that points back at it. Each week is paid like any other booking. The first
-- week is held for the usual 20 minutes while checkout happens; later weeks are
-- held until `pay_by` (48 hours before play) and released if still unpaid, which
-- also tells anyone waiting for that time.
--
-- Safe to re-run. The app works without it: the "Make it a regular" switch only
-- appears once these tables and columns exist.

create table if not exists public.regulars (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  venue_slug        text not null,
  court_type        text,
  start_time        time not null,
  duration_minutes  integer not null check (duration_minutes in (30, 60, 90, 120)),
  start_date        date not null,
  weeks             integer not null check (weeks in (4, 8, 12)),
  -- Weeks that were already taken when the regular was set up (no booking exists).
  clash_dates       date[] not null default '{}',
  status            text not null default 'active' check (status in ('active', 'stopped')),
  created_at        timestamptz not null default now(),
  stopped_at        timestamptz
);

create index if not exists regulars_user on public.regulars (user_id) where status = 'active';

alter table public.regulars enable row level security;

-- Players read their own regulars. All writes go through the app's own routes
-- (service role), which check the club, the courts and the player's limits.
drop policy if exists "Players can read their own regulars" on public.regulars;
create policy "Players can read their own regulars"
  on public.regulars for select
  using (auth.uid() = user_id);

-- Each week of a regular is a normal booking that points at its series.
alter table public.bookings add column if not exists regular_id uuid references public.regulars(id) on delete set null;
-- When a held, unpaid week is released. Null for ordinary bookings (20-minute hold).
alter table public.bookings add column if not exists pay_by timestamptz;
-- When the "this week needs paying" reminder went out, so it goes out once.
alter table public.bookings add column if not exists pay_reminded_at timestamptz;

create index if not exists bookings_regular on public.bookings (regular_id) where regular_id is not null;

-- Per-club rules set by the owner under Club setup. No row means regulars are
-- allowed with no limit.
create table if not exists public.regular_settings (
  venue_slug      text primary key,
  enabled         boolean not null default true,
  -- Most courts regulars may hold at one peak time, so walk-ins always have some.
  -- Null means no limit.
  peak_court_cap  integer check (peak_court_cap is null or peak_court_cap >= 0),
  updated_at      timestamptz not null default now()
);

alter table public.regular_settings enable row level security;

drop policy if exists "Anyone signed in can read regular settings" on public.regular_settings;
create policy "Anyone signed in can read regular settings"
  on public.regular_settings for select
  using (auth.role() = 'authenticated');
