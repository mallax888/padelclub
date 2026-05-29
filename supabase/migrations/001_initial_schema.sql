-- ============================================================
--  PadelClub — Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
--  PROFILES  (extends auth.users 1:1)
-- ============================================================
create table public.profiles (
  id               uuid references auth.users on delete cascade primary key,
  created_at       timestamptz default now() not null,
  full_name        text,
  phone            text,
  membership_tier  text not null default 'casual' check (membership_tier in ('casual','club','pro')),
  credits          integer not null default 0 check (credits >= 0),
  role             text not null default 'member' check (role in ('member','staff','admin')),
  avatar_url       text
);

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
--  COURTS
-- ============================================================
create table public.courts (
  id              uuid default uuid_generate_v4() primary key,
  created_at      timestamptz default now() not null,
  name            text not null,
  type            text not null,
  sport           text not null default 'padel',
  surface         text,
  is_indoor       boolean not null default true,
  price_per_hour  numeric(8,2) not null check (price_per_hour >= 0),
  is_active       boolean not null default true,
  description     text
);

-- Seed courts
insert into public.courts (name, type, sport, surface, is_indoor, price_per_hour, description) values
  ('Court 1', 'Glass-backed', 'padel', 'Artificial grass', true,  35.00, 'Premium indoor glass court'),
  ('Court 2', 'Glass-backed', 'padel', 'Artificial grass', true,  35.00, 'Premium indoor glass court'),
  ('Court 3', 'Open-sided',   'padel', 'Artificial grass', false, 25.00, 'Outdoor court — great on sunny days'),
  ('Court 4', 'Open-sided',   'padel', 'Artificial grass', false, 25.00, 'Outdoor court — great on sunny days');

-- ============================================================
--  BOOKINGS
-- ============================================================
create table public.bookings (
  id                  uuid default uuid_generate_v4() primary key,
  created_at          timestamptz default now() not null,
  user_id             uuid references public.profiles(id) on delete set null,
  court_id            uuid references public.courts(id) on delete cascade not null,
  date                date not null,
  start_time          time not null,
  end_time            time not null,
  duration_minutes    integer not null default 60,
  status              text not null default 'confirmed'
                        check (status in ('pending','confirmed','cancelled','completed','blocked')),
  price_nzd           numeric(8,2) not null default 0,
  discount_applied    numeric(5,4) not null default 0,
  payment_method      text not null default 'card'
                        check (payment_method in ('card','credits','membership_allowance','staff_block')),
  notes               text,

  -- Prevent double-booking the same court at the same time
  constraint no_double_booking unique (court_id, date, start_time)
);

-- Index for fast availability queries
create index bookings_court_date_idx on public.bookings(court_id, date);
create index bookings_user_idx       on public.bookings(user_id);

-- ============================================================
--  MEMBERSHIP SUBSCRIPTIONS
-- ============================================================
create table public.membership_subscriptions (
  id                          uuid default uuid_generate_v4() primary key,
  created_at                  timestamptz default now() not null,
  user_id                     uuid references public.profiles(id) on delete cascade not null,
  tier                        text not null check (tier in ('club','pro')),
  status                      text not null default 'active'
                                check (status in ('active','cancelled','past_due')),
  started_at                  timestamptz default now() not null,
  ends_at                     timestamptz,
  monthly_allowance_used      numeric(8,2) not null default 0,
  monthly_allowance_reset_at  timestamptz default (now() + interval '1 month') not null
);

create index mem_sub_user_idx on public.membership_subscriptions(user_id);

-- ============================================================
--  CREDIT TRANSACTIONS  (audit log)
-- ============================================================
create table public.credit_transactions (
  id          uuid default uuid_generate_v4() primary key,
  created_at  timestamptz default now() not null,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  amount      integer not null,   -- positive = added, negative = used
  type        text not null check (type in ('purchase','used','refund','membership_grant')),
  booking_id  uuid references public.bookings(id) on delete set null,
  description text
);

create index credit_tx_user_idx on public.credit_transactions(user_id);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

-- profiles
alter table public.profiles enable row level security;
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Staff can view all profiles"
  on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

-- courts (public read, staff write)
alter table public.courts enable row level security;
create policy "Anyone can view active courts"
  on public.courts for select using (is_active = true);
create policy "Staff can manage courts"
  on public.courts for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

-- bookings
alter table public.bookings enable row level security;
create policy "Users can view own bookings"
  on public.bookings for select using (auth.uid() = user_id);
create policy "Users can create bookings"
  on public.bookings for insert with check (auth.uid() = user_id);
create policy "Users can cancel own bookings"
  on public.bookings for update using (auth.uid() = user_id);
create policy "Staff can view all bookings"
  on public.bookings for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));
create policy "Staff can manage all bookings"
  on public.bookings for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));
-- Public can see taken slots (for availability) — only time/court/date, not user
create policy "Anyone can check availability"
  on public.bookings for select using (status in ('confirmed','blocked'));

-- membership_subscriptions
alter table public.membership_subscriptions enable row level security;
create policy "Users can view own subscription"
  on public.membership_subscriptions for select using (auth.uid() = user_id);
create policy "Staff can manage subscriptions"
  on public.membership_subscriptions for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));

-- credit_transactions
alter table public.credit_transactions enable row level security;
create policy "Users can view own transactions"
  on public.credit_transactions for select using (auth.uid() = user_id);
create policy "Staff can view all transactions"
  on public.credit_transactions for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin')));
create policy "System can insert transactions"
  on public.credit_transactions for insert with check (auth.uid() = user_id);
