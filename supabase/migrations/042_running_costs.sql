-- A club's running costs, for the breakeven line on the Reports tab.
--   club_running_costs : one row per club that has entered its costs.
--     monthly_cost : what it costs to open the doors for a month, in the club's own currency
--                    (whole units). 0 means "not set": the Reports chart keeps its normal look.
--     show_line    : the on/off switch for the breakeven line (Club settings and the Reports chart).
--
-- Private: row-level security is on with no policies, so only the app's own server (service role)
-- reads or writes it. Front desk never receives it. Safe to re-run. The app works without it: the
-- Reports tab looks exactly as it did and the Club settings card says it is not switched on yet.

create table if not exists public.club_running_costs (
  venue_slug   text primary key,
  monthly_cost numeric(12, 2) not null default 0 check (monthly_cost >= 0 and monthly_cost <= 1000000),
  show_line    boolean not null default true,
  updated_at   timestamptz not null default now()
);
alter table public.club_running_costs enable row level security;
