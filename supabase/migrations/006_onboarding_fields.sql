-- ============================================================
--  Onboarding fields
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Existing users are already "onboarded" -- default true so this
-- migration doesn't retroactively send everyone through the new-user
-- flow. New signups get onboarding_completed = false explicitly via
-- the trigger update below.
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default true;

-- Free-text venue slug (matches a slug in lib/venues.ts) picked during
-- onboarding as the player's home venue. Not a DB foreign key since
-- venues aren't a database table.
alter table public.profiles
  add column if not exists home_venue_slug text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, onboarding_completed)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    false
  );
  return new;
end;
$$;
