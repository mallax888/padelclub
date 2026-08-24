-- ============================================================
--  Fix booking-slot constraints: release cancelled slots, protect
--  blocked slots
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- no_double_booking (from 001_initial_schema.sql) is a plain unique
-- constraint on (court_id, date, start_time) with no status filter. That
-- means once ANY booking has ever existed for a given court/date/time --
-- even one that's since been cancelled -- nobody can ever book that exact
-- slot again, because the cancelled row still occupies it as far as the
-- unique index is concerned. A member cancels, the court is genuinely
-- free, and the next person to try that exact time gets "That slot was
-- just taken!" forever. Replace it with a partial unique index scoped to
-- statuses that actually occupy the slot -- the same scope used below by
-- bookings_no_overlap.
--
-- (This mirrors 005_data_integrity_fixes.sql's own note that the plain
-- unique constraint was already known to be too narrow in one direction --
-- it only caught exact-time collisions, not overlaps -- this migration
-- fixes the other direction: it was also too broad, blocking status that
-- should no longer count as "occupied.")

alter table public.bookings drop constraint if exists no_double_booking;

create unique index if not exists no_double_booking
  on public.bookings (court_id, date, start_time)
  where (status in ('pending', 'confirmed', 'blocked'));

-- bookings_no_overlap (from 005_data_integrity_fixes.sql) only excludes
-- 'confirmed' and 'pending' bookings. A staff-blocked court (status =
-- 'blocked', used by Admin to hold a slot for maintenance or a private
-- event -- see AdminDashboard's blockCourt) isn't included, so a member
-- could still book straight over a blocked slot without hitting this
-- constraint (the exact-time case was only accidentally caught by the
-- old, overly-broad no_double_booking constraint above). Rebuild it with
-- 'blocked' included so blocked time is actually protected.

alter table public.bookings drop constraint if exists bookings_no_overlap;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (court_id with =, period with &&)
  where (status in ('pending', 'confirmed', 'blocked'));
