-- What came back to the player when a booking was cancelled, so My bookings > Past can say "Refunded $X".
--   bookings.refund_cents : the amount returned, in cents (card money, account credit) or 1 for one session credit.
--   bookings.refund_kind  : 'card' (back to their card), 'credit' (account credit) or 'session' (a session credit).
-- Both stay empty for bookings cancelled before this was run, and for cancellations with nothing to return.
-- Safe to re-run. The app works without it: Past just says "Cancelled" instead of "Refunded".

alter table public.bookings
  add column if not exists refund_cents integer,
  add column if not exists refund_kind  text check (refund_kind in ('card', 'credit', 'session'));

comment on column public.bookings.refund_cents is
  'Cents returned to the booker when this booking was cancelled (1 for a single session credit). Null if nothing, or cancelled before this was recorded.';
comment on column public.bookings.refund_kind is
  'How it was returned: card, credit (account credit) or session (a session credit). Null if nothing was returned.';
