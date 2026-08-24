-- ============================================================
--  Country-scoped club managers
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extends the venue-scoping from 014_venue_scoped_staff.sql with a
-- broader, country-level scope: a staff/admin profile with
-- managed_country set can manage every venue in that country, but never
-- sees or writes data for another country's venues. Left null (the
-- default), a profile keeps unrestricted, every-country access, same as
-- managed_venue_slug being null keeps unrestricted, every-venue access.
-- The two combine naturally: managed_venue_slug (one specific venue) is
-- always the narrower scope when both are set.
--
-- This is the mechanism a future self-serve "sign up as a club owner in
-- your country" flow would set automatically. Until that flow exists,
-- set it manually the same way managed_venue_slug is set today:
--   update public.profiles set managed_country = 'New Zealand' where id = '...';
alter table public.profiles
  add column if not exists managed_country text;

-- venue_slug -> country lookup, since neither courts.venue_slug nor
-- tournaments/ladders.venue_slug carry country directly. Mirrors the
-- VENUES -> COUNTRIES.regions mapping in lib/venues.ts -- whenever a new
-- venue is added there (a code change + deploy, same as adding any new
-- venue today), add its slug to the matching country list below too.
create or replace function public.venue_slug_country(p_venue_slug text)
returns text
language sql
immutable
as $$
  select case
    when p_venue_slug in (
      'auckland-albany','auckland-merton','auckland-takapuna','auckland-brownsbay',
      'wellington','christchurch'
    ) then 'New Zealand'
    when p_venue_slug in (
      'nelspruit-play360','nelspruit-padel24',
      'jhb-africa-sandton','jhb-rb-club','jhb-clubpadel-pirates','jhb-africa-dunkeld',
      'cpt-africa-campsbay','cpt-africa-claremont','cpt-atlantic-padel','cpt-rb-club',
      'dbn-africa-ballito','dbn-padel-nation','dbn-gayle-hillcrest',
      'pta-africa-olympus','pta-africa-brooklyn','pta-balwin-waterfall'
    ) then 'South Africa'
    when p_venue_slug in (
      'syd-racquet-club','syd-tribe-padel','syd-indoor-padel-alexandria',
      'mel-recess-padel','mel-g4p-docklands','mel-crown-racquet-club','mel-ipadel',
      'bri-padel-the-gap',
      'per-padel-perth-reabold','per-padelwest','per-west-coast-padel','per-padel-crush','per-padel360','per-padel-kennedy-bay'
    ) then 'Australia'
    else null
  end
$$;

-- Every drop below uses "if exists" so this migration is safe to re-run
-- if it partially applied on an earlier attempt.

-- courts
drop policy if exists "Staff can manage courts" on public.courts;
create policy "Staff can manage courts"
  on public.courts for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = courts.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(courts.venue_slug))
  ));

-- bookings
drop policy if exists "Staff can view all bookings" on public.bookings;
create policy "Staff can view all bookings"
  on public.bookings for select
  using (exists (
    select 1 from public.profiles p
    join public.courts c on c.id = bookings.court_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = c.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(c.venue_slug))
  ));

drop policy if exists "Staff can manage all bookings" on public.bookings;
create policy "Staff can manage all bookings"
  on public.bookings for all
  using (exists (
    select 1 from public.profiles p
    join public.courts c on c.id = bookings.court_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = c.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(c.venue_slug))
  ));

-- membership_subscriptions / credit_transactions -- scoped by the player's
-- home_venue_slug, same as 014.
drop policy if exists "Staff can manage subscriptions" on public.membership_subscriptions;
create policy "Staff can manage subscriptions"
  on public.membership_subscriptions for all
  using (exists (
    select 1 from public.profiles p
    join public.profiles member on member.id = membership_subscriptions.user_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = member.home_venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(member.home_venue_slug))
  ));

drop policy if exists "Staff can view all transactions" on public.credit_transactions;
create policy "Staff can view all transactions"
  on public.credit_transactions for select
  using (exists (
    select 1 from public.profiles p
    join public.profiles member on member.id = credit_transactions.user_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = member.home_venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(member.home_venue_slug))
  ));

-- tournaments
drop policy if exists "Staff manage tournaments" on public.tournaments;
create policy "Staff manage tournaments"
  on public.tournaments for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = tournaments.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(tournaments.venue_slug))
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = tournaments.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(tournaments.venue_slug))
  ));

drop policy if exists "Staff manage tournament players" on public.tournament_players;
create policy "Staff manage tournament players"
  on public.tournament_players for all
  using (exists (
    select 1 from public.profiles p
    join public.tournaments t on t.id = tournament_players.tournament_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = t.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(t.venue_slug))
  ))
  with check (exists (
    select 1 from public.profiles p
    join public.tournaments t on t.id = tournament_players.tournament_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = t.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(t.venue_slug))
  ));

drop policy if exists "Staff manage tournament matches" on public.tournament_matches;
create policy "Staff manage tournament matches"
  on public.tournament_matches for all
  using (exists (
    select 1 from public.profiles p
    join public.tournaments t on t.id = tournament_matches.tournament_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = t.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(t.venue_slug))
  ))
  with check (exists (
    select 1 from public.profiles p
    join public.tournaments t on t.id = tournament_matches.tournament_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = t.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(t.venue_slug))
  ));

-- ladders -- venue_slug is nullable there (a ladder isn't required to
-- belong to one venue), same carve-out as 014.
drop policy if exists "Staff manage ladders" on public.ladders;
create policy "Staff manage ladders"
  on public.ladders for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or ladders.venue_slug is null or p.managed_venue_slug = ladders.venue_slug)
      and (p.managed_country is null or ladders.venue_slug is null or p.managed_country = public.venue_slug_country(ladders.venue_slug))
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or ladders.venue_slug is null or p.managed_venue_slug = ladders.venue_slug)
      and (p.managed_country is null or ladders.venue_slug is null or p.managed_country = public.venue_slug_country(ladders.venue_slug))
  ));
