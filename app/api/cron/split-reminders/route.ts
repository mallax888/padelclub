import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendPushToUser } from '@/lib/push'
import { resend, emailFrom } from '@/lib/resend'
import { renderEmailShell } from '@/lib/email-template'
import { formatPrice, currencyForVenueSlug } from '@/lib/currency'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { getVenue } from '@/lib/venues'
import { formatDate } from '@/lib/utils'
import { getAppUrl } from '@/lib/env'

// Chases the people who owe a share of someone else's booking.
//
// Until this existed, an unpaid share was nobody's problem but the
// organizer's: the only nudge in the app was the WhatsApp button they had to
// press themselves, and release-unpaid-bookings would quietly cancel the
// court twenty minutes later. The money the club never collected and the
// court nobody played on were the same bug.
//
// Three nudges, then it stops. Anything more and the player turns
// notifications off, which is permanent -- the browser never asks twice.
//
// Each stage has two gates. minAgeMinutes is how old the share must be, and
// minGapMinutes is how long since this player was last nudged. The age alone
// was not enough: a share that was already days old when a stage became due
// cleared every age threshold at once, so the first and second nudges landed
// a quarter of an hour apart instead of a day. Spacing them by the last
// nudge is what the player actually experiences, and it is why
// reminder_sent_at is stored.
const STAGES = [
  // Not instant: the invite itself already went out when the booking was
  // made, and a second buzz inside the same minute reads as a glitch. Ten
  // minutes is still inside the window where they're holding their phone.
  { stage: 1, minAgeMinutes: 10, minGapMinutes: 0 },
  // A day later, if it's still outstanding.
  { stage: 2, minAgeMinutes: 60 * 24, minGapMinutes: 60 * 20 },
  // Last call, and only once the game is close enough to be the reason they
  // care -- that extra condition is in nextStage, since it is driven by the
  // booking's start time rather than the share's age. The gap is shorter
  // than stage 2's because by here the game is hours away: insisting on a
  // full day of silence would mean the last call never came at all.
  { stage: 3, minAgeMinutes: 60 * 24 * 2, minGapMinutes: 60 * 6 },
] as const

const FINAL_STAGE = 3
// Stage 3 only fires inside this many hours of the first serve.
const LAST_CALL_HOURS = 14
// Postgres' "column does not exist", raised on every query touching
// reminder_count until 022_split_reminder_tracking.sql has been run. The
// first nudge still goes out without it (see claimStage).
const UNDEFINED_COLUMN = '42703'
// Without the tracking columns there is nothing to mark a share as chased,
// so the only thing keeping a nudge from repeating every run is the age
// window itself: wide enough that a late run still catches the share,
// narrow enough that the next run no longer matches it.
const FALLBACK_WINDOW_MINUTES = 30

type SplitRow = {
  id: string
  user_id: string | null
  invited_by: string | null
  amount_nzd: number
  created_at: string
  reminder_count?: number | null
  reminder_sent_at?: string | null
  bookings: {
    id: string
    date: string
    start_time: string
    status: string
    courts: { name: string | null; venue_slug: string | null } | null
  } | null
  profiles: { email: string | null; full_name: string | null; nickname: string | null } | null
  inviter: { full_name: string | null; nickname: string | null } | null
}

const firstName = (p: { full_name?: string | null; nickname?: string | null } | null | undefined) =>
  p?.nickname ?? p?.full_name?.split(' ')[0] ?? null

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET is not set on this deployment — split reminders cannot run')
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is not set' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const appUrl = getAppUrl(request)
  const now = new Date()

  // The tracking columns are selected optimistically: on a deployment whose
  // database hasn't had 022 applied the whole query fails with 42703, and the
  // retry below drops them rather than the feature.
  const TRACKING_COLUMNS = 'reminder_count, reminder_sent_at,'
  const columns = `
    id, user_id, invited_by, amount_nzd, created_at, ${TRACKING_COLUMNS}
    bookings!booking_splits_booking_id_fkey ( id, date, start_time, status, courts ( name, venue_slug ) ),
    profiles!booking_splits_user_id_fkey ( email, full_name, nickname ),
    inviter:profiles!booking_splits_invited_by_fkey ( full_name, nickname )
  `
  // `as any` for the same reason as /api/admin/replace-player: types/database.ts
  // describes the schema as deployed, and these two columns don't exist there
  // until 022 is run, so the generated types reject the query the fallback
  // below is written to survive.
  const pendingShares = (select: string) =>
    (admin.from('booking_splits') as any)
      .select(select)
      .eq('status', 'pending')
      .not('user_id', 'is', null)

  let tracked = true
  let { data, error } = await pendingShares(columns)
  if (error?.code === UNDEFINED_COLUMN) {
    tracked = false
    ;({ data, error } = await pendingShares(columns.replace(TRACKING_COLUMNS, '')))
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const splits = (data ?? []) as unknown as SplitRow[]
  let sent = 0

  for (const split of splits) {
    const booking = split.bookings
    // A cancelled or released booking has already refunded or withdrawn its
    // shares; chasing one would be asking for money against a court the
    // player can no longer use.
    if (!booking || booking.status !== 'confirmed') continue

    const venueSlug = booking.courts?.venue_slug ?? null
    const startsAt = venueInstant(booking.date, booking.start_time, timezoneForVenueSlug(venueSlug))
    if (startsAt <= now) continue

    const ageMinutes = (now.getTime() - new Date(split.created_at).getTime()) / 60000
    const hoursToStart = (startsAt.getTime() - now.getTime()) / 3600000
    const alreadySent = split.reminder_count ?? 0
    // A share chased for the first time has no gap to measure, and nothing
    // should hold its next nudge back on that account.
    const gapMinutes = split.reminder_sent_at
      ? (now.getTime() - new Date(split.reminder_sent_at).getTime()) / 60000
      : Infinity

    const stage = nextStage({ tracked, alreadySent, ageMinutes, gapMinutes, hoursToStart })
    if (stage === null) continue

    const claimed = await claimStage(admin, split.id, alreadySent, tracked)
    if (!claimed) continue

    await nudge(admin, { split, booking, venueSlug, stage, appUrl })
    sent++
  }

  return NextResponse.json({ remindersSent: sent, tracked })
}

// Which nudge, if any, this share is due for right now.
function nextStage({ tracked, alreadySent, ageMinutes, gapMinutes, hoursToStart }: {
  tracked: boolean
  alreadySent: number
  ageMinutes: number
  gapMinutes: number
  hoursToStart: number
}): number | null {
  if (!tracked) {
    // No stored count to read, so only the first nudge is safe to send: the
    // age window is doing the work a flag would, and the follow-ups are days
    // apart and would each need their own non-overlapping window off a
    // timestamp nothing is updating.
    const first = STAGES[0].minAgeMinutes
    return ageMinutes >= first && ageMinutes < first + FALLBACK_WINDOW_MINUTES ? 1 : null
  }
  if (alreadySent >= FINAL_STAGE) return null
  const due = STAGES[alreadySent]
  if (!due || ageMinutes < due.minAgeMinutes) return null
  // However old the share is, this player was buzzed recently enough that
  // another one now would read as the app malfunctioning rather than as a
  // reminder.
  if (gapMinutes < due.minGapMinutes) return null
  // Last call is about the game, not the invoice: hold it until the match is
  // near, and skip it entirely for a booking made so far ahead that stage 2
  // only just went out.
  if (due.stage === FINAL_STAGE && hoursToStart > LAST_CALL_HOURS) return null
  return due.stage
}

// Takes the right to send this stage before sending it, so two overlapping
// runs can't both nudge the same person. Returns false if another run got
// there first.
async function claimStage(
  admin: ReturnType<typeof createAdminClient>,
  splitId: string,
  alreadySent: number,
  tracked: boolean,
): Promise<boolean> {
  if (!tracked) return true
  const { data, error } = await (admin.from('booking_splits') as any)
    .update({ reminder_count: alreadySent + 1, reminder_sent_at: new Date().toISOString() })
    .eq('id', splitId)
    .eq('reminder_count', alreadySent)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('Could not claim a split reminder for', splitId, error)
    return false
  }
  return !!data
}

// Push, email and the in-app bell. Push alone would reach almost nobody for
// now -- barely anyone has granted permission yet -- and this is the one
// nudge that is literally about money, so it is worth an email too.
async function nudge(
  admin: ReturnType<typeof createAdminClient>,
  { split, booking, venueSlug, stage, appUrl }: {
    split: SplitRow
    booking: NonNullable<SplitRow['bookings']>
    venueSlug: string | null
    stage: number
    appUrl: string
  },
) {
  const currency = currencyForVenueSlug(venueSlug)
  const amount = formatPrice(split.amount_nzd, currency)
  const organizer = firstName(split.inviter) ?? 'Someone'
  const player = firstName(split.profiles) ?? 'there'
  const court = booking.courts?.name ?? 'your court'
  const date = formatDate(booking.date)
  const time = booking.start_time.slice(0, 5)
  const isLastCall = stage === FINAL_STAGE
  const url = '/mybookings'

  const title = isLastCall ? `${amount} still to pay` : `${organizer} booked you in`
  const body = isLastCall
    ? `${court} is ${date} at ${time} — tap to pay your ${amount} share.`
    : `Your share is ${amount} for ${court}, ${date} at ${time}.`

  await sendPushToUser(admin, split.user_id!, { title, body, url })

  const { error: notifyError } = await admin.from('notifications').insert({
    user_id: split.user_id,
    type: 'split_reminder',
    message: `${amount} still to pay for ${court} on ${date}`,
  })
  if (notifyError) {
    console.error('Could not write a split reminder to the bell for', split.user_id, notifyError)
  }

  const email = split.profiles?.email
  if (!email) return
  const venue = venueSlug ? getVenue(venueSlug) : null
  try {
    await resend.emails.send({
      from: emailFrom(),
      to: email,
      subject: isLastCall ? `Last call — ${amount} for ${date}` : `${organizer} booked you in — ${amount}`,
      html: renderEmailShell({
        heading: isLastCall ? '⏰ Your game is coming up' : '🎾 You owe a share',
        intro: isLastCall
          ? `Hi ${player}, your game is on ${date} and your ${amount} share is still outstanding.`
          : `Hi ${player}, ${organizer} booked a court and put you down for ${amount}.`,
        rows: [
          { label: 'Court', value: court },
          { label: 'Date', value: date },
          { label: 'Time', value: time },
          { label: 'Your share', value: amount },
        ],
        ctaText: `Pay ${amount}`,
        ctaUrl: `${appUrl}${url}`,
        footer: venue ? `PadelClub · ${venue.name}, ${venue.region}` : 'PadelClub',
      }),
    })
  } catch (err) {
    // A bounced reminder shouldn't undo the claim -- the push and the bell
    // entry have already gone out, and retrying the whole stage would
    // double up on both.
    console.error('Could not email a split reminder to', email, err)
  }
}
