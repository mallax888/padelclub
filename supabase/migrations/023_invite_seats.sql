-- ============================================================
--  Invite seats: let a booker split a court with someone who has
--  no account yet
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- A split used to be a row with a member already attached: the booker picked
-- someone from the member list, and that member's user_id went on the row. A
-- friend who hadn't signed up had no way in.
--
-- An invite seat is the same row with user_id still null and a secret token on
-- it. The booker shares /join/<token>; whoever opens it, signs in and accepts
-- fills in user_id, and from that moment it is an ordinary split -- it appears
-- in their My Bookings with a Pay button and goes through exactly the checkout
-- every other share does.
--
-- Keeping it a booking_splits row, rather than a table of its own, is what
-- keeps the money right. Checkout (create-checkout) and the payer's own
-- checkout (pay-split) both divide the court fee by the number of rows on the
-- booking, so a seat held open for someone who hasn't joined yet is already
-- counted: the booker is charged their real share on day one, not a larger one
-- that quietly drops when the friend shows up.

alter table public.booking_splits
  add column if not exists invite_token text;

-- One token, one seat. Partial, because every ordinary split has none.
create unique index if not exists booking_splits_invite_token_key
  on public.booking_splits (invite_token)
  where invite_token is not null;

-- 018 documents user_id as nullable, and the generated types agree, so this is
-- a no-op on the live database. It is here so a database that was ever set up
-- with a NOT NULL on it cannot reject the very rows this feature depends on.
alter table public.booking_splits
  alter column user_id drop not null;

comment on column public.booking_splits.invite_token is
  'Secret token on an invite seat -- a split nobody has claimed yet (user_id is null). Whoever holds the /join/<token> link and signs in can claim it. Cleared of meaning once user_id is set.';
