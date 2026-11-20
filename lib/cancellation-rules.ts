// A club's cancellation rule: how long before play a booking can be cancelled for a full refund, and what
// happens to the money after that. Pure functions (no database, no React) so the maths and the wording
// are tested on their own and the server and the screens always agree.

export type CancellationRule = { freeHours: number; after: 'half' | 'keep' }
export const FREE_HOURS = [2, 6, 12, 24, 48] as const
// What every club had before the rule could be changed.
export const DEFAULT_RULE: CancellationRule = { freeHours: 24, after: 'half' }

export const isFreeHours = (n: unknown): n is number => typeof n === 'number' && (FREE_HOURS as readonly number[]).includes(n)

export function ruleFromRow(row: { free_hours?: unknown; after_action?: unknown } | null | undefined): CancellationRule {
  if (!row) return DEFAULT_RULE
  return { freeHours: isFreeHours(row.free_hours) ? row.free_hours : DEFAULT_RULE.freeHours, after: row.after_action === 'keep' ? 'keep' : 'half' }
}

export function validateRule(input: any): { value: Partial<CancellationRule> } | { error: string } {
  const value: Partial<CancellationRule> = {}
  if (input?.freeHours !== undefined) { if (!isFreeHours(input.freeHours)) return { error: 'Choose 2, 6, 12, 24 or 48 hours.' }; value.freeHours = input.freeHours }
  if (input?.after !== undefined) { if (input.after !== 'half' && input.after !== 'keep') return { error: 'Choose what happens after that.' }; value.after = input.after }
  if (Object.keys(value).length === 0) return { error: 'Nothing to change.' }
  return { value }
}

// A full refund at this much notice.
export const isFree = (hoursUntil: number, rule: CancellationRule): boolean => hoursUntil >= rule.freeHours

export const hoursWord = (h: number): string => `${h} ${h === 1 ? 'hour' : 'hours'}`

// "After that, cancelling gives half back as account credit" / "...keeps the payment".
export const afterText = (rule: CancellationRule): string =>
  rule.after === 'half' ? 'After that, cancelling gives half back as account credit.' : 'After that, the payment is kept.'

// One line for the booking screen, with the actual moment when it is known: "Free cancellation until Sat 6:00 am".
export function freeUntilLine(rule: CancellationRule, cutoff?: string): string {
  return cutoff ? `Free cancellation until ${cutoff}` : `Free cancellation until ${hoursWord(rule.freeHours)} before`
}

// The short policy line under My bookings.
export const policySummary = (rule: CancellationRule): string => `Cancel ${hoursWord(rule.freeHours)}+ before for a full refund`
export const policyDetail = (rule: CancellationRule): string =>
  `${rule.after === 'half' ? `Cancel under ${hoursWord(rule.freeHours)} and half comes back as account credit.` : `Cancel under ${hoursWord(rule.freeHours)} and the payment is kept.`} Reschedule to a new date or time any time before the ${rule.freeHours}hr mark, no charge. Everyone else on a split booking is refunded in full, whatever the notice.`

// What cancelling now gives back, for the confirmation: the full refund, half as credit, or nothing.
export function cancelOutcome(hoursUntil: number, rule: CancellationRule): 'full' | 'half' | 'none' {
  if (isFree(hoursUntil, rule)) return 'full'
  return rule.after === 'half' ? 'half' : 'none'
}

// The moment free cancellation ends for a booking that starts at startMs.
export const freeUntilMs = (startMs: number, rule: CancellationRule): number => startMs - rule.freeHours * 3600000

// "Sat 6:00 am": the moment free cancellation ends, on the court's own clock.
export function cutoffLabel(startMs: number, rule: CancellationRule, tz: string): string {
  const at = new Date(freeUntilMs(startMs, rule))
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(at)
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at)
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0), m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${day} ${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`
}

// The two lines on the booking screen: while there is still time, when free cancellation ends and what comes after;
// once the booking is inside the window, what cancelling would give back.
export function bookingRuleLines(rule: CancellationRule, startMs: number, nowMs: number, tz: string): { title: string; note: string } {
  if (freeUntilMs(startMs, rule) > nowMs) return { title: freeUntilLine(rule, cutoffLabel(startMs, rule, tz)), note: afterText(rule) }
  return { title: 'No free cancellation on this booking', note: rule.after === 'half' ? 'It starts in less than ' + hoursWord(rule.freeHours) + ', so cancelling gives half back as account credit.' : 'It starts in less than ' + hoursWord(rule.freeHours) + ', so the payment is kept if you cancel.' }
}
