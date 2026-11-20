-- Club announcements: an owner writes one short message and a club's players get it as a notification
-- (and optionally an email), and it sits on their Home screen until it expires.
--   club_announcements : one row per message. told_count is how many players were told.
--
-- Private: row-level security is on with no policies, so only the app's own server (service role) reads or
-- writes it. Safe to re-run. The app works without it: the message box says it is not switched on yet and
-- Home simply shows no notice.

create table if not exists public.club_announcements (
  id           uuid primary key default gen_random_uuid(),
  venue_slug   text not null,
  title        text not null check (char_length(title) between 1 and 80),
  body         text not null default '' check (char_length(body) <= 500),
  by_push      boolean not null default true,
  by_email     boolean not null default false,
  show_on_home boolean not null default true,
  told_count   integer not null default 0,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists club_announcements_venue_idx on public.club_announcements (venue_slug, created_at desc);
alter table public.club_announcements enable row level security;
