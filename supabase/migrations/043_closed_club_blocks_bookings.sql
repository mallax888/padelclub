-- A club whose owner has switched booking off no longer takes new bookings from players.
--
-- Until now the switch only hid the club from the booking screens: a player who already had the booking page open could
-- still finish a booking, and so could anything talking to the database directly. This puts the rule where it can't be
-- skipped: a player's new booking is refused when the club's venue_settings row says is_open_for_booking = false.
--
-- Not affected: bookings that already exist (they stay and can be paid and played), the club team's own bookings and
-- court blocks (staff and owners), and anything PadelMate's server does with its service key (regulars, offers, payments).
--
-- Built to fail safe: if venue_settings is missing (the 025 change hasn't been run) or anything goes wrong while checking,
-- the booking goes through as it always did. Safe to re-run.

create or replace function public.block_booking_when_club_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  closed boolean := false;
begin
  -- the server's own jobs
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  begin
    -- the club team (front desk and owners) can always put a booking or a block on the diary
    if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff', 'admin')) then
      return new;
    end if;
    select exists (
      select 1
      from public.courts c
      join public.venue_settings v on v.venue_slug = c.venue_slug
      where c.id = new.court_id and v.is_open_for_booking = false
    ) into closed;
  exception when others then
    closed := false;   -- could not check: let the booking through
  end;

  if closed then
    raise exception 'This club isn''t taking bookings right now.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists block_booking_when_club_closed on public.bookings;
create trigger block_booking_when_club_closed
  before insert on public.bookings
  for each row execute function public.block_booking_when_club_closed();
