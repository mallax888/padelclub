-- ============================================================
--  Xero integration — live sync of paid bookings/credits/
--  memberships into Xero as Receive Money bank transactions
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Holds the club's Xero OAuth connection. Single-row in practice (one club,
-- one Xero organisation) -- the app deletes any existing row before
-- inserting a new one on (re)connect, so "the" connection is just
-- "select * limit 1".
create table public.xero_connections (
  id                     uuid default uuid_generate_v4() primary key,
  created_at             timestamptz default now() not null,
  updated_at             timestamptz default now() not null,
  tenant_id              text not null,
  tenant_name            text,
  access_token           text not null,
  refresh_token          text not null,
  expires_at             timestamptz not null,
  bank_account_id        text,
  bank_account_name      text,
  revenue_account_code   text,
  revenue_account_name   text,
  connected_by           uuid references public.profiles(id) on delete set null
);

-- RLS enabled with NO policies at all -- this table holds live OAuth
-- tokens, so it's intentionally unreachable from anon/authenticated roles
-- entirely. Every read/write goes through server routes using the
-- service-role admin client, which bypasses RLS.
alter table public.xero_connections enable row level security;
