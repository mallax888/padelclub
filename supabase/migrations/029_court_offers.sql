-- Fill my empty courts: an owner discounts a gap in the diary and tells past players.
--
-- An offer is a venue, a date, a window of hours and a discount percent. It closes
-- two hours before it starts (closes_at) and then simply stops applying, so nothing
-- has to run to end it. A booking made inside the window while the offer was open
-- carries its offer_id; the server re-checks that when the booking is paid, so a
-- discount can't be made up by a hand-built request.
--
-- Safe to re-run. The app works without it: no offers appear and nothing changes.

create table if not exists public.court_offers (
  id               uuid primary key default gen_random_uuid(),
  venue_slug       text not null,
  date             date not null,
  start_time       time not null,
  end_time         time not null,
  discount_percent integer not null check (discount_percent in (10, 20, 30)),
  audience         text not null default 'past_players' check (audience in ('past_players', 'home_club')),
  courts_free      integer,
  told_count       integer not null default 0,
  status           text not null default 'active' check (status in ('active', 'cancelled')),
  closes_at        timestamptz not null,
  -- When the owner ended it early. Bookings made before then keep the discount.
  cancelled_at     timestamptz,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists court_offers_lookup on public.court_offers (venue_slug, date) where status = 'active';

alter table public.court_offers enable row level security;

-- Anyone signed in can see offers that are still open (they are an advert). Creating,
-- ending and reading results go through the app's own routes (service role), which
-- check the owner and their reach.
drop policy if exists "Signed-in players can see open offers" on public.court_offers;
create policy "Signed-in players can see open offers"
  on public.court_offers for select
  using (auth.role() = 'authenticated' and status = 'active' and closes_at > now());

-- The offer a booking was made under.
alter table public.bookings add column if not exists offer_id uuid references public.court_offers(id) on delete set null;
create index if not exists bookings_offer on public.bookings (offer_id) where offer_id is not null;
