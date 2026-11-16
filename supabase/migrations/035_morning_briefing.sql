-- The morning briefing: a daily message to a club's owners with yesterday's takings and bookings,
-- the busy times still empty today, overdue shares and new players.
--   briefing_settings : one row per club that has changed its briefing. A club with no row gets the
--                       defaults: on, 7am, by phone and email.
--   briefing_log      : one row per club per day once the briefing has gone out, so it is never sent twice.
--
-- Both are private: row-level security is on with no policies, so only the app's own server (service
-- role) reads or writes them. Safe to re-run. The app works without it: the briefing simply does not
-- run, and the settings card says it is not switched on yet.

create table if not exists public.briefing_settings (
  venue_slug   text primary key,
  enabled      boolean not null default true,
  send_hour    integer not null default 7 check (send_hour between 5 and 10),
  by_push      boolean not null default true,
  by_email     boolean not null default true,
  updated_at   timestamptz not null default now()
);
alter table public.briefing_settings enable row level security;

create table if not exists public.briefing_log (
  venue_slug   text not null,
  date         text not null,
  sent_at      timestamptz not null default now(),
  owners       integer not null default 0,
  primary key (venue_slug, date)
);
alter table public.briefing_log enable row level security;
