-- ============================================================
--  Guard credit-pack purchases against duplicate Stripe webhooks
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Stripe redelivers checkout.session.completed on any timeout/5xx from our
-- webhook, and there was nothing recording which session a credit_transactions
-- row came from — a retry would insert a second row and double-credit the
-- user's balance for a single payment. This column lets the webhook detect
-- (and the database enforce) that a given Stripe checkout session is only
-- ever applied once.
alter table public.credit_transactions
  add column stripe_session_id text unique;
