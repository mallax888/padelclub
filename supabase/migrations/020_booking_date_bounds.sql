-- ============================================================
--  Bound the dates a member can book
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- "Users can create bookings" (001_initial_schema.sql) checks only that the
-- row belongs to the caller:
--
--   with check (auth.uid() = user_id)
--
-- Bookings are inserted straight from the browser, so that was the only thing
-- standing between a hand-rolled request and a row dated 2019 or 2031. The
-- booking window the UI enforces (14/21/28 days by membership tier) lives
-- entirely in TypeScript and a crafted insert never sees it.
--
-- The bound below is deliberately looser than any tier's window rather than a
-- reimplementation of it: 180 days is comfortably clear of the 28-day
-- maximum, so no legitimate booking is refused and the tier logic stays in
-- one place, while the absurd cases stop being possible. Past dates are
-- refused outright.
--
-- Staff are unaffected: "Staff can manage all bookings"
-- (017_country_scoped_staff.sql) is a separate policy, so blocking out a
-- court retrospectively still works.
--
-- current_date is the Postgres server's date (UTC on Supabase). A venue up to
-- 13 hours ahead can be a calendar day further on, which is why the lower
-- bound allows yesterday rather than today -- refusing on the boundary would
-- mean an Auckland member couldn't book their own evening for the first hours
-- of the local day.

drop policy if exists "Users can create bookings" on public.bookings;
create policy "Users can create bookings"
  on public.bookings for insert
  with check (
    auth.uid() = user_id
    and date >= current_date - interval '1 day'
    and date <= current_date + interval '180 days'
  );
