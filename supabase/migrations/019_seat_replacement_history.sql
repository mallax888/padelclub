-- ============================================================
--  Track who previously held a seat when a player is replaced
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- When a player pulls out and staff slot someone else into their seat, the
-- seat is relabelled in place: the payment (and its stripe_payment_id) stays
-- exactly where it is and the two players settle up between themselves --
-- no refund, no re-charge. That keeps the money simple, but it also means
-- the row no longer shows that a swap ever happened, and the admin roster
-- has no way to answer "hang on, wasn't that Sarah's spot?".
--
-- These columns keep that answer: the profile who last held the seat, and
-- when they were replaced. Only the most recent predecessor is retained
-- (that's all the roster displays); a seat swapped twice shows the person
-- immediately before the current holder, not the full chain.

alter table public.booking_splits
  add column if not exists replaced_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists replaced_at timestamptz;

alter table public.open_match_players
  add column if not exists replaced_player_id uuid references public.profiles(id) on delete set null,
  add column if not exists replaced_at timestamptz;
