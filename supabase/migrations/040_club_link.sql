-- Booking link: remember which club's link a player first came through.
-- Only ever set once, when someone finishes sign-up after opening a club's link.
alter table public.profiles add column if not exists joined_via_venue text;
