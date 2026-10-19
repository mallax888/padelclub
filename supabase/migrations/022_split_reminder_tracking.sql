-- ============================================================
--  Track which unpaid-share reminders have gone out
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- /api/cron/split-reminders chases people who owe a share of a booking. It
-- runs unattended every 15 minutes, so it needs a record of what it has
-- already sent -- otherwise every run would nudge the same person again and
-- a pending share would produce a notification every quarter hour until the
-- game.
--
-- reminder_count doubles as the claim: the cron increments it with a
-- conditional update (`where reminder_count = <the value it read>`) and only
-- sends when that update actually matched a row, so two overlapping runs
-- cannot both send the same stage.
--
-- The cron works without these columns -- it falls back to sending only the
-- first nudge, and leans on a narrow age window instead of a stored flag --
-- so the app is not broken while this migration is unrun. It just can't
-- send the follow-ups until it is.

alter table booking_splits
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists reminder_count integer not null default 0;

-- The cron's own lookup: pending shares, oldest claim first.
create index if not exists booking_splits_pending_reminders_idx
  on booking_splits (status, reminder_count)
  where status = 'pending';

comment on column booking_splits.reminder_sent_at is
  'When the last unpaid-share reminder was sent for this row. Written only by /api/cron/split-reminders.';
comment on column booking_splits.reminder_count is
  'How many unpaid-share reminders have been sent (0-3). Used as an optimistic-lock claim so a stage can only be sent once.';
