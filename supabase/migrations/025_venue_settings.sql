-- Per-club settings: real opening hours and whether the club is open for booking.
--
-- Until now every club was assumed open 07:00-22:00 and any club with a row in
-- `courts` was bookable. A club with NO row here keeps behaving exactly that way,
-- so running this changes nothing for existing clubs until an owner uses
-- Admin > More > Club setup.
--
--   is_open_for_booking  false hides the club from players ("Courts coming soon")
--                        even once it has courts, so a club can be set up in private.
--   hours                {"mon": {"open":"06:00","close":"22:00"}, ..., "sun": null}
--                        null for a day means closed that day; a null column means
--                        "never set", which the app reads as 07:00-22:00.
--
-- Safe to re-run. The app also works without this table (every club keeps the
-- defaults); only saving setup needs it.

create table if not exists public.venue_settings (
  venue_slug           text primary key,
  is_open_for_booking  boolean not null default true,
  hours                jsonb,
  updated_at           timestamptz not null default now()
);

alter table public.venue_settings enable row level security;

-- Players need to read these to see when a club is open and whether it is
-- bookable. Nobody writes through the API directly: owners change them through
-- the app's own routes, which check who is asking and use the service role.
drop policy if exists "Anyone can read venue settings" on public.venue_settings;
create policy "Anyone can read venue settings"
  on public.venue_settings for select
  using (true);
