-- ============================================================
--  Data-integrity fixes from the follow-up audit
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- --------------------------------------------------------------
-- 1. Atomic credit/points increments
-- --------------------------------------------------------------
-- The app previously did select-credits, then update-credits-plus-N as two
-- separate round trips. Two purchases/matches landing close together for the
-- same user could race and one increment would be silently lost. These do
-- the read-and-write as a single atomic statement instead.

create or replace function public.increment_credits(p_user_id uuid, p_amount int)
returns void
language sql
as $$
  update public.profiles set credits = credits + p_amount where id = p_user_id;
$$;

create or replace function public.record_match_result(p_user_id uuid, p_win boolean, p_points int)
returns void
language sql
as $$
  update public.profiles
  set
    wins = wins + case when p_win then 1 else 0 end,
    losses = losses + case when p_win then 0 else 1 end,
    ranking_points = ranking_points + p_points
  where id = p_user_id;
$$;

-- --------------------------------------------------------------
-- 2. Prevent overlapping bookings on the same court
-- --------------------------------------------------------------
-- The only existing safeguard was unique(court_id, date, start_time), which
-- only blocks two bookings starting at the exact same time -- a 90-minute
-- booking at 10:00 and a 60-minute booking at 10:30 on the same court could
-- both be inserted. This adds a real overlap check at the database level.
--
-- NOTE: if this ADD CONSTRAINT fails, it means there's already overlapping
-- data in the table. Find it first with something like:
--   select b1.id, b2.id, b1.court_id, b1.date, b1.start_time, b2.start_time
--   from public.bookings b1 join public.bookings b2
--     on b1.court_id = b2.court_id and b1.date = b2.date and b1.id < b2.id
--   where b1.status in ('confirmed','pending') and b2.status in ('confirmed','pending')
--     and (b1.date + b1.start_time, b1.date + b1.end_time)
--         overlaps (b2.date + b2.start_time, b2.date + b2.end_time);

create extension if not exists btree_gist;

alter table public.bookings
  add column if not exists period tsrange generated always as (
    tsrange(date + start_time, date + end_time)
  ) stored;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (court_id with =, period with &&)
  where (status in ('confirmed', 'pending'));

-- --------------------------------------------------------------
-- 3. Prevent an open match from being accepted past capacity
-- --------------------------------------------------------------
-- The client updated open_match_players.status directly with no capacity
-- check at all -- an organizer accepting two pending requests in quick
-- succession could push the accepted count past spots_total. This function
-- re-checks capacity and locks the match row (for update) so two concurrent
-- accepts for the same match can't both slip through, and verifies the
-- caller is actually the match's organizer since it runs as security
-- definer (bypassing whatever RLS exists on these tables).

create or replace function public.accept_match_player(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_spots int;
  v_organizer_id uuid;
  v_accepted int;
  v_updated int;
begin
  select match_id into v_match_id from public.open_match_players where id = p_request_id and status = 'pending';
  if v_match_id is null then
    return false;
  end if;

  select spots_total, organizer_id into v_spots, v_organizer_id from public.open_matches where id = v_match_id for update;
  if v_organizer_id is distinct from auth.uid() then
    raise exception 'Only the match organizer can accept requests';
  end if;

  select count(*) into v_accepted from public.open_match_players where match_id = v_match_id and status = 'accepted';
  if v_accepted >= v_spots then
    return false;
  end if;

  update public.open_match_players set status = 'accepted' where id = p_request_id and status = 'pending';
  get diagnostics v_updated = row_count;

  if v_updated > 0 and v_accepted + 1 >= v_spots then
    update public.open_matches set status = 'full' where id = v_match_id;
  end if;

  return v_updated > 0;
end;
$$;

-- --------------------------------------------------------------
-- 4. Idempotency guard for recording a match
-- --------------------------------------------------------------
-- Nothing stopped a double-submit (double click bypassing the disabled
-- state, or a retried request) from inserting the same match twice and
-- doubling both players' points. The app now sends a per-submission key;
-- this unique column lets a retry be ignored instead of applied twice.

alter table public.matches
  add column if not exists idempotency_key text unique;
