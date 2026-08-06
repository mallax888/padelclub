-- ============================================================
--  Restrict which profile columns a user can self-edit
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- "Users can update own profile" (using auth.uid() = id) only restricts
-- *which row* a user can touch, not *which columns* -- Postgres RLS is
-- row-level only. Any logged-in user could currently set their own role to
-- 'admin', or set credits/membership_tier/wins/ranking_points to anything,
-- from the browser console.
--
-- Column-level GRANTs close this: they run alongside RLS and restrict which
-- columns the "authenticated" role (i.e. any logged-in PostgREST request)
-- is allowed to write, regardless of the row-level policy. Everything else
-- (role, credits, membership_tier, wins, losses, ranking_points,
-- member_number, email) becomes update-only via the service-role admin
-- client used in the app's API routes, which bypasses both RLS and these
-- grants entirely.
revoke update on public.profiles from authenticated;
grant update (nickname, skill_level, skill_rating) on public.profiles to authenticated;
