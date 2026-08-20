-- ============================================================
--  Push notifications
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table public.push_subscriptions (
  id          uuid default uuid_generate_v4() primary key,
  created_at  timestamptz default now() not null,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tracks whether the "court time in 2 hours" reminder has already gone out
-- for a booking, so the cron job (which re-scans all upcoming bookings on
-- every run) doesn't push the same reminder twice.
alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;
