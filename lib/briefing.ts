// The morning briefing: what happened yesterday, what is still empty today, and what needs chasing.
// Pure rules (no database, no email, no React) so the numbers and the wording are tested on their own.
//   * Sent to the owners of a club at a time they choose (7am by default), by phone and email.
//   * Yesterday is compared with the same weekday a week earlier, in plain amounts, never percentages,
//     so a small club does not see silly numbers.
//   * Nothing is predicted: every figure is something that already happened or is booked.
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { esc } from '@/lib/escape'

// ------------------------------------------------------------------ settings
export type BriefingSettings = { enabled: boolean; hour: number; push: boolean; email: boolean }
export const DEFAULT_BRIEFING: BriefingSettings = { enabled: true, hour: 7, push: true, email: true }
export const BRIEFING_HOURS = [5, 6, 7, 8, 9, 10] as const
// It is sent by an hourly job, which can run late, so a briefing still goes out for a few hours after the
// chosen time. A log of what was sent keeps it to once a day.
export const SEND_WINDOW_HOURS = 3

export function validateBriefing(raw: any): { ok: true; value: Partial<BriefingSettings> } | { ok: false; error: string } {
  const v: Partial<BriefingSettings> = {}
  if (raw?.enabled !== undefined) { if (typeof raw.enabled !== 'boolean') return { ok: false, error: 'Invalid request.' }; v.enabled = raw.enabled }
  if (raw?.push !== undefined) { if (typeof raw.push !== 'boolean') return { ok: false, error: 'Invalid request.' }; v.push = raw.push }
  if (raw?.email !== undefined) { if (typeof raw.email !== 'boolean') return { ok: false, error: 'Invalid request.' }; v.email = raw.email }
  if (raw?.hour !== undefined) {
    if (!Number.isInteger(raw.hour) || !(BRIEFING_HOURS as readonly number[]).includes(raw.hour)) return { ok: false, error: 'Choose a time between 5am and 10am.' }
    v.hour = raw.hour
  }
  if (Object.keys(v).length === 0) return { ok: false, error: 'Nothing to save.' }
  return { ok: true, value: v }
}

export const hourLabel = (h: number): string => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'am' : 'pm'}`

// Send now? Only inside the window after the chosen hour, only if switched on, and only once a day.
export function shouldSend(s: BriefingSettings, localHour: number, alreadySentToday: boolean): boolean {
  if (!s.enabled || alreadySentToday) return false
  if (!s.push && !s.email) return false
  return localHour >= s.hour && localHour < s.hour + SEND_WINDOW_HOURS
}

// ------------------------------------------------------------------ the numbers
export type BookingRow = { date: string; start_time: string; end_time: string; status: string; price_nzd: number | string | null }
const counted = (b: { status: string }) => b.status === 'confirmed' || b.status === 'completed'
const minutesOf = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10)

export type DayTotals = { bookings: number; revenue: number; bookedHours: number }
export function dayTotals(rows: BookingRow[], date: string): DayTotals {
  const day = rows.filter(b => b.date === date && counted(b))
  return {
    bookings: day.length,
    revenue: day.reduce((a, b) => a + (Number(b.price_nzd) || 0), 0),
    bookedHours: day.reduce((a, b) => a + Math.max(0, minutesOf(b.end_time) - minutesOf(b.start_time)) / 60, 0),
  }
}

export type BriefingInput = {
  yesterday: DayTotals
  lastWeek: { bookings: number; revenue: number }
  sellableHours: number // court hours the club could have sold yesterday
  emptyPrimeHours: number // empty court-hours in busy times still to sell today
  bestGap: { from: string; to: string; courtsFree: number } | null
  overdue: { count: number; total: number | null }
  newPlayers: number
}
export type Briefing = {
  takings: number; takingsDiff: number | null
  bookings: number; bookingsDiff: number | null
  fillPct: number | null
  emptyPrimeHours: number; bestGap: BriefingInput['bestGap']
  overdueCount: number; overdueTotal: number | null
  newPlayers: number
  quiet: boolean // nothing happened and nothing needs doing
}

export function buildBriefing(i: BriefingInput): Briefing {
  const hadLastWeek = i.lastWeek.bookings > 0 || i.lastWeek.revenue > 0
  const round = (n: number) => Math.round(n * 100) / 100
  const b: Briefing = {
    takings: round(i.yesterday.revenue),
    takingsDiff: hadLastWeek ? round(i.yesterday.revenue - i.lastWeek.revenue) : null,
    bookings: i.yesterday.bookings,
    bookingsDiff: hadLastWeek ? i.yesterday.bookings - i.lastWeek.bookings : null,
    fillPct: i.sellableHours > 0 ? Math.min(100, Math.round((i.yesterday.bookedHours / i.sellableHours) * 100)) : null,
    emptyPrimeHours: Math.max(0, Math.round(i.emptyPrimeHours)),
    bestGap: i.bestGap,
    overdueCount: i.overdue.count, overdueTotal: i.overdue.total,
    newPlayers: i.newPlayers,
    quiet: false,
  }
  b.quiet = b.bookings === 0 && b.emptyPrimeHours === 0 && b.overdueCount === 0 && b.newPlayers === 0
  return b
}

// ------------------------------------------------------------------ the words
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const amount = (n: number, cur: CurrencyCode) => formatPrice(n, cur).replace(/\.00$/, '')

// "$210 up on last Sunday" / "$40 down on last Sunday" / "the same as last Sunday" / nothing to compare.
export function describeDiff(diff: number | null, weekday: string, money: boolean, cur: CurrencyCode): string {
  if (diff === null) return ''
  if (diff === 0) return `the same as last ${weekday}`
  const n = Math.abs(diff)
  const what = money ? amount(n, cur) : String(n)
  return `${what} ${diff > 0 ? 'up' : 'down'} on last ${weekday}`
}

export const gapText = (g: NonNullable<Briefing['bestGap']>) => `${g.from}–${g.to}, ${plural(g.courtsFree, 'court', 'courts')} free`
const emptyLine = (b: Briefing) =>
  b.emptyPrimeHours > 0
    ? `${plural(b.emptyPrimeHours, 'prime court-hour is', 'prime court-hours are')} empty today.`
    : 'Prime time today is fully booked.'

export type PushMessage = { title: string; body: string; url: string }

// The phone message(s): a main one, and a second only when shares are overdue.
export function briefingPush(b: Briefing, o: { name: string; currency: CurrencyCode; weekday: string; todayUrl: string; fixUrl: string }): PushMessage[] {
  const hi = `Morning, ${o.name}.`
  const main: PushMessage = b.quiet
    ? { title: `${hi} All clear`, body: 'Nothing to chase and nothing empty today. Have a good one.', url: o.todayUrl }
    : b.bookings === 0
      ? { title: `${hi} Yesterday was quiet`, body: `No bookings. ${emptyLine(b)}${b.emptyPrimeHours > 0 ? ' Tap to fill them.' : ''}`, url: b.emptyPrimeHours > 0 ? o.fixUrl : o.todayUrl }
      : {
          title: `${hi} Yesterday: ${amount(b.takings, o.currency)}`,
          body: [
            `${plural(b.bookings, 'booking', 'bookings')}${b.takingsDiff !== null ? `, ${describeDiff(b.takingsDiff, o.weekday, true, o.currency)}` : ''}.`,
            emptyLine(b) + (b.emptyPrimeHours > 0 ? ' Tap to fill them.' : ''),
          ].join(' '),
          url: b.emptyPrimeHours > 0 ? o.fixUrl : o.todayUrl,
        }
  const out = [main]
  if (b.overdueCount > 0) {
    out.push({
      title: `${plural(b.overdueCount, 'share is', 'shares are')} overdue${b.overdueTotal !== null ? ` (${amount(b.overdueTotal, o.currency)})` : ''}`,
      body: 'Tap to remind both players in one go.', url: o.fixUrl,
    })
  }
  return out
}

// The email. Every button opens a screen inside the app.
export function briefingEmail(b: Briefing, o: { name: string; venueName: string; currency: CurrencyCode; weekday: string; todayUrl: string; fixUrl: string; settingsUrl: string }): { subject: string; html: string } {
  const subject = b.quiet ? `${o.venueName}: all clear this morning` : b.bookings === 0 ? `${o.venueName}: a quiet day yesterday` : `Yesterday at ${o.venueName}: ${amount(b.takings, o.currency)}`
  const stat = (big: string, small: string) => `<td style="background:#f1f4f8;border-radius:10px;padding:10px 12px;vertical-align:top"><div style="font-size:20px;font-weight:800">${esc(big)}</div><div style="font-size:11px;color:#6a727c;margin-top:2px">${esc(small)}</div></td>`
  const item = (title: string, small: string, btn: string, url: string) =>
    `<tr><td style="border-top:1px solid #e3e7ec;padding:12px 0"><div style="font-size:14px;font-weight:700">${esc(title)}</div><div style="font-size:12px;color:#6a727c;margin-top:2px">${esc(small)}</div></td><td align="right" style="border-top:1px solid #e3e7ec;padding:12px 0 12px 12px"><a href="${esc(url)}" style="background:#2F70CC;color:#fff;font-weight:700;border-radius:8px;padding:8px 14px;font-size:12px;text-decoration:none;white-space:nowrap">${esc(btn)}</a></td></tr>`
  const diffMoney = describeDiff(b.takingsDiff, o.weekday, true, o.currency)
  const diffCount = describeDiff(b.bookingsDiff, o.weekday, false, o.currency)
  const headline = b.quiet ? 'All clear this morning.' : b.bookings === 0 ? 'Yesterday was a quiet one.' : 'Here is yesterday.'
  const rows: string[] = []
  if (b.emptyPrimeHours > 0) rows.push(item(emptyLine(b).replace(/\.$/, ''), b.bestGap ? `Biggest gap: ${gapText(b.bestGap)}` : 'In the busy times', 'Fill them', o.fixUrl))
  if (b.overdueCount > 0) rows.push(item(`${plural(b.overdueCount, 'share is', 'shares are')} overdue`, b.overdueTotal !== null ? `${amount(b.overdueTotal, o.currency)} still to collect` : 'Still to collect', 'Remind both', o.fixUrl))
  if (b.newPlayers > 0) rows.push(item(`${plural(b.newPlayers, 'new player', 'new players')} joined yesterday`, 'Have a look at who they are', 'See players', o.todayUrl.replace('/admin/today', '/players')))
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;color:#1b1f24;border-radius:14px;overflow:hidden;border:1px solid #e3e7ec">
<div style="background:#262B31;color:#fff;padding:14px 22px;font-size:11px;letter-spacing:.14em;font-weight:800">PADEL<span style="color:#86BBF7">CLUB</span> · Good morning, ${esc(o.name)}</div>
<div style="padding:22px">
<h2 style="margin:0 0 4px;font-size:21px">${esc(headline)}</h2>
<p style="margin:0 0 14px;font-size:13px;color:#4a525c;line-height:1.55">${esc(o.venueName)} in 30 seconds.</p>
${b.bookings > 0 || b.fillPct !== null ? `<table role="presentation" width="100%" cellspacing="8" style="margin:0 -8px 12px"><tr>${stat(amount(b.takings, o.currency), diffMoney ? `takings, ${diffMoney}` : 'takings')}${stat(String(b.bookings), diffCount ? `bookings, ${diffCount}` : plural(b.bookings, 'booking', 'bookings'))}${stat(b.fillPct === null ? '–' : `${b.fillPct}%`, 'of court hours booked')}</tr></table>` : ''}
<table role="presentation" width="100%" cellspacing="0">${rows.join('')}</table>
<p style="margin:16px 0 0;font-size:12px"><a href="${esc(o.todayUrl)}" style="color:#2F70CC;font-weight:700;text-decoration:none">Open Today</a></p>
<p style="margin:14px 0 0;font-size:11.5px;color:#8a929c">You get this each morning. <a href="${esc(o.settingsUrl)}" style="color:#8a929c">Change the time or stop it</a> in Club settings.</p>
</div></div>`
  return { subject, html }
}
