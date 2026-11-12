-- Per-club membership plans: each club sets its own plans (name, price, discount,
-- how far ahead members can book, extra perks) and can give a plan to a member.
--
-- A club with no rows here simply has the standard Casual / Club / Pro plans, exactly
-- as before, so nothing changes until an owner edits their plans. A member's plan is
-- still profiles.membership_tier (now any plan key, not just casual/club/pro) and
-- applies at their home club.
--
-- Safe to re-run. The app works without it: plans stay as they are today.

create table if not exists public.club_plans (
  id                  uuid primary key default gen_random_uuid(),
  venue_slug          text not null,
  key                 text not null,
  name                text not null,
  -- In the club's own currency (whole units).
  price               numeric(10,2) not null default 0 check (price >= 0),
  discount_percent    integer not null default 0 check (discount_percent between 0 and 30),
  booking_window_days integer not null default 14 check (booking_window_days between 1 and 60),
  perks               text[] not null default '{}',
  active              boolean not null default true,
  sort                integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (venue_slug, key)
);

alter table public.club_plans enable row level security;

-- Plans are public information (they are what a club advertises). Changing them goes
-- through the app's own owner routes (service role).
drop policy if exists "Signed-in players can see club plans" on public.club_plans;
create policy "Signed-in players can see club plans"
  on public.club_plans for select
  using (auth.role() = 'authenticated');

-- A plan key can now be a club's own, not only casual / club / pro.
alter table public.profiles drop constraint if exists profiles_membership_tier_check;
alter table public.membership_subscriptions drop constraint if exists membership_subscriptions_tier_check;

-- Who gave a plan for free (null for one the member paid for).
alter table public.membership_subscriptions add column if not exists granted_by uuid references public.profiles(id) on delete set null;
