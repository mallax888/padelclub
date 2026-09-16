-- ============================================================
--  A Xero bank account per currency
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- syncReceiveMoneyToXero took its amount as "amountNzd" and was handed
-- session.amount_total straight from Stripe -- whatever currency the charge
-- was actually in. Court fees have been billed in each venue's own currency
-- for as long as the app has had Australian and South African venues, so a
-- R490 payment was already being written into Xero as the bare number 490
-- against a New Zealand dollar bank account. Revenue from those two
-- countries has been overstated in the books ever since.
--
-- Xero won't accept the obvious fix on its own: a bank transaction has to be
-- in its bank account's currency, so a rand payment cannot be posted to an
-- NZD account no matter how it's labelled. It needs a separate account per
-- currency, which is a thing the club sets up in Xero (foreign currency
-- accounts need multi-currency on their Xero plan) and then picks here.
--
-- Both columns are nullable and both stay empty for a club that only trades
-- in one currency. Where no account is configured for a payment's currency,
-- the sync now skips that payment and logs why, rather than writing a number
-- that means something different from what it says.

alter table public.xero_connections
  add column if not exists bank_account_id_aud text,
  add column if not exists bank_account_name_aud text,
  add column if not exists bank_account_id_zar text,
  add column if not exists bank_account_name_zar text;

comment on column public.xero_connections.bank_account_id is
  'Xero bank account for NZD payments. The default: a club trading only in New Zealand needs no others.';
comment on column public.xero_connections.bank_account_id_aud is
  'Xero bank account for AUD payments. Null means Australian income is not synced.';
comment on column public.xero_connections.bank_account_id_zar is
  'Xero bank account for ZAR payments. Null means South African income is not synced.';
