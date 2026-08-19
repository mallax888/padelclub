-- ============================================================
--  Update all NZ court pricing: $70/hr off-peak, $80/hr peak
--  (peak = evenings 17:00-21:00 and weekends, per lib/pricing.ts)
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

alter table public.courts
  add column if not exists price_per_hour_peak numeric(8,2);

update public.courts
set price_per_hour = 70.00,
    price_per_hour_peak = 80.00
where is_active = true;
