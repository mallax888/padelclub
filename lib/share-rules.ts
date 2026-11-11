// The deadline rules for unpaid shares, as pure functions (client-safe): when a
// friend must pay by, when the booker is asked to cover what's left, and when the
// court is released if that doesn't happen. Used by the cron that enforces it, the
// route that takes the booker's cover payment, and My bookings, so they agree.

const HOUR = 3600 * 1000

// A friend must have paid this long before play.
export const SHARE_DEADLINE_HOURS = 24
// Bookings made less than this long before play get no deadline at all: there
// isn't time to ask anyone to cover or to sell the court again, so the club keeps
// chasing as before.
export const MIN_NOTICE_HOURS = 4
// A booking made well ahead (at least this long) gets the full 24 hours deadline.
export const FULL_RULE_NOTICE_HOURS = 30
// How long the booker has to cover once the deadline passes.
export const COVER_WINDOW_HOURS = 6
export const SHORT_NOTICE_COVER_HOURS = 2
// The booker is always asked first, and a court is only released at least this
// long after they were asked -- so a late cron run, or a booking already past its
// window, still gives them a real chance to cover. Never released in the last hour.
export const RELEASE_GRACE_HOURS = 2
export const NO_RELEASE_LAST_HOURS = 1

export type ShareSchedule = { deadline: number; coverUntil: number }
export type ShareStage = 'before' | 'cover' | 'release'

// null when the booking is too close to play to enforce anything.
export function shareSchedule(startMs: number, createdMs: number): ShareSchedule | null {
  const notice = (startMs - createdMs) / HOUR
  if (!(notice >= MIN_NOTICE_HOURS)) return null
  if (notice >= FULL_RULE_NOTICE_HOURS) {
    const deadline = startMs - SHARE_DEADLINE_HOURS * HOUR
    return { deadline, coverUntil: deadline + COVER_WINDOW_HOURS * HOUR }
  }
  // Short notice: friends get about six hours, but never past three hours before
  // play; the booker then gets two hours, and the court is let go an hour out at the latest.
  const deadline = Math.min(createdMs + 6 * HOUR, startMs - 3 * HOUR)
  return { deadline, coverUntil: Math.min(deadline + SHORT_NOTICE_COVER_HOURS * HOUR, startMs - HOUR) }
}

export function shareStage(s: ShareSchedule, nowMs: number): ShareStage {
  if (nowMs < s.deadline) return 'before'
  return nowMs < s.coverUntil ? 'cover' : 'release'
}

// What the booker is asked to cover: every share still unpaid, in cents. Each
// share is the court fee over the number of share rows plus the booker, rounded to
// the cent exactly as the friend's own checkout does it, so a covered share costs
// the booker what the friend would have paid.
export function shareCents(courtPrice: number, totalShareRows: number): number {
  return Math.round((courtPrice / (totalShareRows + 1)) * 100)
}
export const coverCents = (courtPrice: number, totalShareRows: number, unpaidCount: number): number =>
  shareCents(courtPrice, totalShareRows) * unpaidCount

export type ShareLite = { status: string }
export const unpaidShares = <T extends ShareLite>(shares: T[]): T[] => shares.filter(s => s.status === 'pending')

// May the court be released now? Only after the booker was asked and given the
// grace period, and not in the hour before play.
export function releaseAllowed(nowMs: number, startMs: number, notifiedAtMs: number | null): boolean {
  if (notifiedAtMs === null || !Number.isFinite(notifiedAtMs)) return false
  return nowMs >= notifiedAtMs + RELEASE_GRACE_HOURS * HOUR && nowMs <= startMs - NO_RELEASE_LAST_HOURS * HOUR
}
