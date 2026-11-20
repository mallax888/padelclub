-- A club's cancellation rule, and marking a booking as a no-show.
--   cancellation_rules : one row per club that has changed its rule. A club with no row keeps the rule
--                        the app has always had: free cancellation 24 hours before, then half back as
--                        account credit.
--   bookings.no_show_at : set by the club team when nobody turned up. The payment is kept; this only
--                        records it.
--
-- cancellation_rules is private: row-level security is on with no policies, so only the app's own server
-- (service role) reads or writes it. Safe to re-run. The app works without it: every club keeps the
-- default rule and the settings card says it is not switched on yet.

create table if not exists public.cancellation_rules (
  venue_slug   text primary key,
  free_hours   integer not null default 24 check (free_hours in (2, 6, 12, 24, 48)),
  after_action text not null default 'half' check (after_action in ('half', 'keep')),
  updated_at   timestamptz not null default now()
);
alter table public.cancellation_rules enable row level security;

alter table public.bookings
  add column if not exists no_show_at timestamptz;

comment on column public.bookings.no_show_at is
  'When the club team marked this booking as a no-show (nobody turned up). Null otherwise.';
