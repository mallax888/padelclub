-- ============================================================
--  Add Mexicano as a second tournament format
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

alter table public.tournaments drop constraint tournaments_format_check;
alter table public.tournaments add constraint tournaments_format_check
  check (format in ('americano', 'mexicano'));
