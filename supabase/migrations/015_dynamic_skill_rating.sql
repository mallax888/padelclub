-- ============================================================
--  Dynamic skill rating (Elo-style)
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- skill_rating already exists (seeded from the self-declared skill_level at
-- onboarding) but nothing ever adjusted it afterwards -- an overconfident
-- signup stayed "Advanced" forever regardless of how they actually played.
-- This atomically applies an Elo-style delta computed by the match-recording
-- API route, clamped to the same 0.5-7.0 range the skill-level scale uses.
-- Atomic DB-side update, not select-then-update -- two matches for the same
-- player landing close together shouldn't be able to race and lose one
-- adjustment.
create or replace function public.apply_skill_rating_delta(p_user_id uuid, p_delta numeric)
returns void
language sql
as $$
  update public.profiles
  set skill_rating = greatest(0.5, least(7.0, coalesce(skill_rating, 1.0) + p_delta))
  where id = p_user_id;
$$;
