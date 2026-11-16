// Server-only: gathers a club's numbers for the morning briefing and hands them to the pure rules in
// lib/briefing.ts. Used by the daily job and by the card on the Today screen, so both always agree.
import { resend, emailFrom } from '@/lib/resend'
import { currencyForVenueSlug, type CurrencyCode } from '@/lib/currency'
import { addDaysStr, venueClock } from '@/lib/today'
import { bestSlotsToFill, computeEmptyCourtTime, splitOverdueShares } from '@/lib/money-demand'
import { mapUnpaidShares, unpaidSharesQuery } from '@/lib/unpaid-shares'
import { loadVenueSettings, weekFor } from '@/lib/venue-settings'
import { dayHours, toMinutes } from '@/lib/venue-hours'
import { timezoneForVenueSlug, venueInstant } from '@/lib/timezone'
import { COUNTRIES, getVenue } from '@/lib/venues'
import { buildBriefing, dayTotals, DEFAULT_BRIEFING, type Briefing, type BriefingSettings } from '@/lib/briefing'

export type LoadedBriefing = { briefing: Briefing; venueName: string; currency: CurrencyCode; weekday: string; yesterday: string; today: string }

// Yesterday at this club, against the same weekday a week before, plus what is still open today.
export async function loadBriefing(admin: any, venueSlug: string, nowMs: number): Promise<LoadedBriefing | null> {
  const clock = venueClock(venueSlug, nowMs)
  const yesterday = addDaysStr(clock.date, -1)
  const lastWeekDay = addDaysStr(yesterday, -7)
  const { data: courts } = await admin.from('courts').select('id, price_per_hour, price_per_hour_peak, is_active').eq('venue_slug', venueSlug).eq('is_active', true)
  if (!courts || courts.length === 0) return null
  const tz = timezoneForVenueSlug(venueSlug)
  const startOfYesterday = venueInstant(yesterday, '00:00:00', tz).toISOString()
  const startOfToday = venueInstant(clock.date, '00:00:00', tz).toISOString()

  const [{ data: rows }, venueSettings, unpaid, joined] = await Promise.all([
    admin.from('bookings').select('court_id, date, start_time, end_time, status, price_nzd').in('court_id', courts.map((c: any) => c.id)).in('date', [clock.date, yesterday, lastWeekDay]),
    loadVenueSettings(admin),
    unpaidSharesQuery(admin, { venueSlug }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('home_venue_slug', venueSlug).gte('created_at', startOfYesterday).lt('created_at', startOfToday),
  ])
  const bookings = (rows ?? []) as any[]
  const week = weekFor(venueSettings, venueSlug)
  const hours = dayHours(week, yesterday)
  const sellableHours = hours ? courts.length * Math.max(0, toMinutes(hours.close) - toMinutes(hours.open)) / 60 : 0
  const empty = computeEmptyCourtTime(courts, bookings.filter(b => b.date === clock.date), venueSlug, nowMs, 1, week)
  const best = bestSlotsToFill(empty.slots.filter(s => s.kind === 'peak'), 1)[0] ?? null
  const overdue = splitOverdueShares(mapUnpaidShares((unpaid as any)?.data), venueSlug, nowMs)

  const briefing = buildBriefing({
    yesterday: dayTotals(bookings, yesterday),
    lastWeek: dayTotals(bookings, lastWeekDay),
    sellableHours,
    emptyPrimeHours: empty.peak.empty,
    bestGap: best ? { from: best.from, to: best.to, courtsFree: best.empty } : null,
    overdue: { count: overdue.overdue.length, total: overdue.overdue.length > 0 ? overdue.overdueTotal : null },
    newPlayers: (joined as any)?.error ? 0 : ((joined as any)?.count ?? 0),
  })
  return {
    briefing, venueName: getVenue(venueSlug).name, currency: currencyForVenueSlug(venueSlug),
    weekday: new Intl.DateTimeFormat('en-NZ', { weekday: 'long', timeZone: 'UTC' }).format(new Date(yesterday + 'T12:00:00Z')),
    yesterday, today: clock.date,
  }
}

// A club's briefing settings; null when the 035 database change has not been run.
export async function loadBriefingSettings(admin: any, venueSlug: string): Promise<BriefingSettings | null> {
  const { data, error } = await admin.from('briefing_settings').select('*').eq('venue_slug', venueSlug).maybeSingle()
  if (error) return null
  if (!data) return { ...DEFAULT_BRIEFING }
  return { enabled: !!data.enabled, hour: Number(data.send_hour), push: !!data.by_push, email: !!data.by_email }
}

// The people who get a club's briefing: its owners. The platform admin (an owner with no club or country) is not
// one of them, or they would get a message for every club.
export async function briefingRecipients(admin: any, venueSlug: string): Promise<{ id: string; name: string; email: string | null }[]> {
  const { data } = await admin.from('profiles').select('id, full_name, nickname, email, managed_venue_slug, managed_country').eq('role', 'admin')
  const country = COUNTRIES.find(c => c.regions.includes(getVenue(venueSlug).region))?.name ?? null
  return ((data ?? []) as any[])
    .filter(p => p.managed_venue_slug === venueSlug || (!p.managed_venue_slug && p.managed_country && p.managed_country === country))
    .map(p => ({ id: p.id as string, name: ((p.nickname ?? p.full_name ?? '') as string).split(' ')[0] || 'there', email: (p.email ?? null) as string | null }))
}

// Best effort: a failed email never stops the phone message or the bell.
export async function sendBriefingEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  try { await resend.emails.send({ from: emailFrom(), to, subject, html }); return true } catch (e) { console.error('Could not send a briefing email to', to, e); return false }
}
