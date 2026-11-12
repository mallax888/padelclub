-- Where a club is, as set by its owner, for "clubs near me". Every club already has a
-- position worked out from its address (about the suburb); an owner can put it exactly
-- where the club is by using their phone while standing there. Clearing it goes back
-- to the address-based position.
--
-- Safe to re-run. The app works without it: "clubs near me" uses the address-based
-- positions, and the owner's "set location" button simply says it isn't switched on yet.

alter table public.venue_settings add column if not exists lat double precision;
alter table public.venue_settings add column if not exists lng double precision;
