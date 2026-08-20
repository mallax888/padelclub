-- ============================================================
--  Venue-scoped club managers
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- A staff/admin profile with managed_venue_slug set can only manage that
-- one venue's courts/bookings/members/tournaments/ladders. Left null (the
-- default -- nothing changes for existing staff until you explicitly set
-- this), a staff/admin profile keeps today's unrestricted, every-venue
-- access. To make someone a scoped club manager:
--   update public.profiles set managed_venue_slug = 'the-venue-slug' where id = '...';
alter table public.profiles
  add column if not exists managed_venue_slug text;

-- Note on scope: "Anyone can view active courts" / "Anyone can check
-- availability" (every member needs to see every venue to book anywhere),
-- and "Members can view all profiles" (the players directory/leaderboard,
-- open to every member, not staff-specific) all stay untouched below --
-- none of these can be venue-restricted without breaking a normal feature
-- for everyone. Read scoping for Admin's own views instead comes from the
-- app's own queries (app/(app)/admin/page.tsx filters explicitly by
-- managed_venue_slug), while the policies below are what actually stop a
-- scoped manager from *writing* to another venue's courts/bookings/
-- subscriptions/tournaments/ladders -- there's no competing permissive
-- write policy on any of these, so RLS fully enforces the write side.
--
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
  ));

drop policy if exists "Staff can manage all bookings" on public.bookings;
create policy "Staff can manage all bookings"
  on public.bookings for all
  using (exists (
    select 1 from public.profiles p
    join public.courts c on c.id = bookings.court_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = c.venue_slug)
  ));

-- membership_subscriptions / credit_transactions -- scoped by the player's
-- home_venue_slug (set during onboarding), the closest existing concept to
-- "which club is this player a member of". (profiles itself is left alone
-- here -- its SELECT policy is "Members can view all profiles", open to
-- every member for the players directory, not a staff-only policy to
-- narrow.)
drop policy if exists "Staff can manage subscriptions" on public.membership_subscriptions;
create policy "Staff can manage subscriptions"
  on public.membership_subscriptions for all
  using (exists (
    select 1 from public.profiles p
    join public.profiles member on member.id = membership_subscriptions.user_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = member.home_venue_slug)
  ));

drop policy if exists "Staff can view all transactions" on public.credit_transactions;
create policy "Staff can view all transactions"
  on public.credit_transactions for select
  using (exists (
    select 1 from public.profiles p
    join public.profiles member on member.id = credit_transactions.user_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = member.home_venue_slug)
  ));

-- tournaments -- already has its own venue_slug column
drop policy if exists "Staff manage tournaments" on public.tournaments;
create policy "Staff manage tournaments"
  on public.tournaments for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = tournaments.venue_slug)
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = tournaments.venue_slug)
  ));

drop policy if exists "Staff manage tournament players" on public.tournament_players;
create policy "Staff manage tournament players"
  on public.tournament_players for all
  using (exists (
    select 1 from public.profiles p
    join public.tournaments t on t.id = tournament_players.tournament_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = t.venue_slug)
  ))
  with check (exists (
    select 1 from public.profiles p
    join public.tournaments t on t.id = tournament_players.tournament_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = t.venue_slug)
  ));

drop policy if exists "Staff manage tournament matches" on public.tournament_matches;
create policy "Staff manage tournament matches"
  on public.tournament_matches for all
  using (exists (
    select 1 from public.profiles p
    join public.tournaments t on t.id = tournament_matches.tournament_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = t.venue_slug)
  ))
  with check (exists (
    select 1 from public.profiles p
    join public.tournaments t on t.id = tournament_matches.tournament_id
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or p.managed_venue_slug = t.venue_slug)
  ));

-- ladders -- venue_slug is nullable there (a ladder isn't required to
-- belong to one venue), so an unscoped ladder stays manageable by any
-- staff regardless of their own scoping.
drop policy if exists "Staff manage ladders" on public.ladders;
create policy "Staff manage ladders"
  on public.ladders for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or ladders.venue_slug is null or p.managed_venue_slug = ladders.venue_slug)
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin')
      and (p.managed_venue_slug is null or ladders.venue_slug is null or p.managed_venue_slug = ladders.venue_slug)
  ));
