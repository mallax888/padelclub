-- Owners and front desk.
--
-- 'admin' is the Owner; 'staff' is Front desk. Front desk runs the day (bookings,
-- the Board, members, competitions) but should not set court prices or read the
-- club's credit records. Until now every staff policy accepted both roles.
--
-- Courts: anyone can still see ACTIVE courts (the public read policy in 001), so
-- front desk keeps seeing the courts they book onto. Only creating, editing and
-- deleting courts -- and seeing inactive ones -- becomes owner-only.
-- credit_transactions: owner-only to read.
--
-- Optional and safe to re-run. Run it AFTER you have checked that the people who
-- should be Owners have role = 'admin':
--   select email, role from public.profiles where role in ('staff', 'admin');

drop policy if exists "Staff can manage courts" on public.courts;
drop policy if exists "Owners can manage courts" on public.courts;
create policy "Owners can manage courts"
  on public.courts for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
      and (p.managed_venue_slug is null or p.managed_venue_slug = courts.venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(courts.venue_slug))
  ));

drop policy if exists "Staff can view all transactions" on public.credit_transactions;
drop policy if exists "Owners can view all transactions" on public.credit_transactions;
create policy "Owners can view all transactions"
  on public.credit_transactions for select
  using (exists (
    select 1 from public.profiles p
    join public.profiles member on member.id = credit_transactions.user_id
    where p.id = auth.uid() and p.role = 'admin'
      and (p.managed_venue_slug is null or p.managed_venue_slug = member.home_venue_slug)
      and (p.managed_country is null or p.managed_country = public.venue_slug_country(member.home_venue_slug))
  ));
