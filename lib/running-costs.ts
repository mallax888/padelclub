// A club's running costs and the breakeven line they draw on the Reports chart. Pure functions (no database,
// no React) so the maths and the wording are tested on their own and the server and the screens agree.

export type RunningCosts = { monthly: number; show: boolean }
export const NO_COSTS: RunningCosts = { monthly: 0, show: true }
// A month is counted as 30 days, so $9,000 a month is $300 a day. Simple enough for an owner to check in their head.
export const DAYS_PER_MONTH = 30
export const MAX_MONTHLY = 1_000_000

const round2 = (n: number) => Math.round(n * 100) / 100

export function costsFromRow(row: { monthly_cost?: unknown; show_line?: unknown } | null | undefined): RunningCosts {
  if (!row) return NO_COSTS
  const m = Number(row.monthly_cost)
  return { monthly: Number.isFinite(m) && m > 0 && m <= MAX_MONTHLY ? round2(m) : 0, show: row.show_line !== false }
}

export function validateCosts(input: any): { value: Partial<RunningCosts> } | { error: string } {
  const value: Partial<RunningCosts> = {}
  if (input?.monthly !== undefined) {
    const m = typeof input.monthly === 'number' ? input.monthly : NaN
    if (!Number.isFinite(m) || m < 0 || m > MAX_MONTHLY) return { error: 'Enter what your club costs to run each month, as a number.' }
    value.monthly = round2(m)
  }
  if (input?.show !== undefined) { if (typeof input.show !== 'boolean') return { error: 'Choose on or off.' }; value.show = input.show }
  if (Object.keys(value).length === 0) return { error: 'Nothing to change.' }
  return { value }
}

// What a day has to take to cover its share of the costs.
export const dailyBreakeven = (monthly: number): number => (monthly > 0 ? round2(monthly / DAYS_PER_MONTH) : 0)

// The breakeven line is drawn only when costs are entered and the switch is on.
export const lineIsOn = (c: RunningCosts | null | undefined): boolean => !!c && c.monthly > 0 && c.show

export type DayMark = { date: string; revenue: number; state: 'made' | 'below' | 'today' }
export type BreakevenView = {
  daily: number
  marks: DayMark[]
  countedDays: number   // finished days in the period (today is still going, so it is not counted)
  madeDays: number
  taken: number         // takings on those days
  costs: number         // the costs for those days
  left: number          // taken minus costs: negative is a loss
  todayInRange: boolean
}

// Each day is "made" (took at least the daily breakeven), "below", or "today" (still going, so neither).
export function breakevenView(byDay: { date: string; revenue: number }[], monthly: number, todayStr: string): BreakevenView {
  const daily = dailyBreakeven(monthly)
  const marks: DayMark[] = byDay.map(d => ({ date: d.date, revenue: d.revenue, state: d.date >= todayStr ? 'today' : d.revenue >= daily ? 'made' : 'below' }))
  const done = marks.filter(m => m.state !== 'today')
  const taken = round2(done.reduce((s, m) => s + m.revenue, 0))
  const costs = round2(daily * done.length)
  return {
    daily, marks, countedDays: done.length, madeDays: done.filter(m => m.state === 'made').length,
    taken, costs, left: round2(taken - costs), todayInRange: marks.some(m => m.state === 'today'),
  }
}

// "$300 a day" style wording for the settings card, from an already formatted price.
export const perDayText = (formattedDaily: string): string => `about ${formattedDaily} a day`
