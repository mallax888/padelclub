-- ============================================================
--  Paying for a regular's weeks in one go
--  One card payment can cover several weeks. Each week remembers its own slice of
--  that payment, so skipping one week (or stopping the regular) refunds just that
--  slice and leaves the other weeks paid.
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

alter table public.bookings
  add column if not exists paid_cents integer;

comment on column public.bookings.paid_cents is
  'Cents of a shared payment that cover this booking (set only when several weeks of a regular were paid together). Null for ordinary one-booking payments.';
