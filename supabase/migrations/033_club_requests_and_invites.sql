-- 033: Start-a-club requests and emailed team invites.
-- Additive only: two new tables. Nothing existing is changed, renamed or removed.
-- Both tables have row level security switched on with NO policies, so the browser (anon and
-- signed-in users) can never read or write them. Only the server (service role) touches them.

create table if not exists public.club_requests (
  id            uuid primary key default gen_random_uuid(),
  club_name     text not null,
  country       text not null,
  city          text not null,
  address       text,
  courts        integer check (courts is null or (courts between 1 and 100)),
  phone         text,
  contact_name  text not null,
  email         text not null,
  status        text not null default 'pending' check (status in ('pending','approved','declined')),
  venue_slug    text,
  decline_reason text,
  decided_by    uuid references public.profiles(id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists club_requests_status_idx on public.club_requests (status, created_at desc);
-- One waiting request per email, so a form cannot be used to flood the list.
create unique index if not exists club_requests_one_pending_per_email on public.club_requests (lower(email)) where status = 'pending';
alter table public.club_requests enable row level security;

create table if not exists public.team_invites (
  id                  uuid primary key default gen_random_uuid(),
  token_hash          text not null unique,      -- only a hash is stored; the link holds the real token
  email               text not null,
  role                text not null check (role in ('admin','staff')),
  managed_venue_slug  text,
  managed_country     text,
  invited_by          uuid references public.profiles(id) on delete set null,
  request_id          uuid references public.club_requests(id) on delete set null,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  used_at             timestamptz,
  cancelled_at        timestamptz
);
create index if not exists team_invites_email_idx on public.team_invites (lower(email));
alter table public.team_invites enable row level security;
