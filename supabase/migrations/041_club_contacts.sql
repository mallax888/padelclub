-- Player import: people a club brings in from its own spreadsheet. They are the club's contacts, not accounts: they only
-- become players when they sign up themselves from the invite. Written only by the server (service role); no browser access.
create table if not exists public.club_contacts (
  id uuid primary key default gen_random_uuid(),
  venue_slug text not null,
  name text not null,
  email text not null,                       -- always lower case
  phone text,
  last_played date,                          -- from the club's file, never from PadelMate bookings
  user_id uuid references public.profiles(id) on delete set null,   -- set once they have an account
  status text not null default 'imported' check (status in ('imported', 'invited', 'joined')),
  invited_at timestamptz,
  reminded_at timestamptz,                   -- one reminder only: once set, they are never reminded again
  unsubscribed_at timestamptz,               -- once set, they are never emailed again
  imported_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (venue_slug, email)
);
create index if not exists club_contacts_venue_idx on public.club_contacts (venue_slug, status);
create index if not exists club_contacts_email_idx on public.club_contacts (email);
alter table public.club_contacts enable row level security;
-- No policies on purpose: only the server (service role) reads or writes these.
