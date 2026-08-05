-- ============================================================
--  Allow users to delete their own notifications
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- The notifications table has RLS enabled but (most likely) no DELETE
-- policy, so a user's delete request matches zero rows instead of
-- erroring -- the notification survives in the database and reappears
-- next time it's fetched, even though the UI showed it as removed.
create policy "Users can delete their own notifications"
  on public.notifications
  for delete
  using (auth.uid() = user_id);
