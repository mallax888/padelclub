-- Unpaid shares get a deadline: the booker covers them or the court is released.
--
-- A friend's share (or an unclaimed invite seat) has to be paid by a deadline,
-- 24 hours before play for a normal booking. After it the booker is asked to cover
-- what is still unpaid, and has a few hours to; if they don't, the court is
-- released and everyone who paid is refunded.
--
-- covered_by marks a share the booker paid for, so My bookings can say so and the
-- friend can't pay it a second time. share_cover_notified_at makes sure the
-- "please cover this" message to the booker goes out once.
--
-- Safe to re-run. The app works without it: nothing is enforced and nothing about
-- covering shows until these columns exist.

alter table public.booking_splits add column if not exists covered_by uuid references public.profiles(id) on delete set null;
alter table public.bookings add column if not exists share_cover_notified_at timestamptz;

-- Bookings that already exist when this is first run keep the old rules: nobody
-- who booked under them is suddenly held to a deadline they were never told about.
-- Only bookings made after this change are enforced. The backfill runs once, the
-- first time the column is added, so re-running this file does not exempt newer bookings.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'share_deadline_exempt'
  ) then
    alter table public.bookings add column share_deadline_exempt boolean not null default false;
    update public.bookings set share_deadline_exempt = true where status = 'confirmed' and date >= current_date - 1;
  end if;
end $$;
