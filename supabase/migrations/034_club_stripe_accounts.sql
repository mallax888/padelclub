-- Clubs get paid straight into their own Stripe account (Stripe Connect).
--   club_stripe_accounts : one row per club that has started connecting Stripe. Holds the
--                          Stripe account id, what Stripe says it can do, and the PadelClub
--                          fee for that club (2.5% unless the platform admin changes it).
--   payment_accounts     : for every card payment that went to a club's account, which
--                          account it went to and what the fees were. Refunds and the
--                          booking breakdown read it. Payments made before a club connected
--                          have no row here and stay on PadelClub's own account.
--
-- Both are private: row-level security is on with no policies, so only the app's own
-- server (service role) can read or write them. Players and owners never read them directly.
--
-- Safe to re-run. The app works without it: payments simply keep going to PadelClub's own
-- account and the "Get paid directly" card says it isn't switched on yet.

create table if not exists public.club_stripe_accounts (
  venue_slug          text primary key,
  stripe_account_id   text not null unique,
  details_submitted   boolean not null default false,
  charges_enabled     boolean not null default false,
  payouts_enabled     boolean not null default false,
  requirements_due    text[] not null default '{}',
  fee_percent         numeric(5,2) not null default 2.5 check (fee_percent >= 0 and fee_percent <= 20),
  fee_fixed           numeric(6,2) not null default 0 check (fee_fixed >= 0 and fee_fixed <= 5),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.club_stripe_accounts enable row level security;

create table if not exists public.payment_accounts (
  payment_intent      text primary key,
  stripe_account      text not null,
  venue_slug          text,
  paid_cents          integer not null default 0,
  app_fee_cents       integer not null default 0,
  stripe_fee_cents    integer,
  created_at          timestamptz not null default now()
);
alter table public.payment_accounts enable row level security;
create index if not exists payment_accounts_venue_idx on public.payment_accounts (venue_slug, created_at desc);
