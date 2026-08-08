-- ============================================================
--  Allow self-updating the onboarding columns
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 004_lock_down_profiles_columns.sql restricted authenticated users to
-- self-updating only (nickname, skill_level, skill_rating). The onboarding
-- flow also needs to write home_venue_slug and onboarding_completed --
-- both harmless preference/flag columns, unlike credits/membership_tier/
-- role/wins/losses/ranking_points/member_number/email which stay locked
-- down. This is additive: it doesn't touch the existing grant.
grant update (home_venue_slug, onboarding_completed) on public.profiles to authenticated;
