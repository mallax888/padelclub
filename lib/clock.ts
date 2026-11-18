// How a time of day reads on screen and in messages: "6:00 pm", never "18:00". The database and every comparison keep
// the 24-hour "HH:MM" / "HH:MM:SS" text; only what a person reads goes through here.
const parts = (t: string | null | undefined): { h: number; m: number } | null => {
  const x = /^(\d{1,2}):(\d{2})/.exec(String(t ?? '').trim())
  if (!x) return null
  let h = Number(x[1]); const m = Number(x[2])
  if (h === 24 && m === 0) h = 0 // 24:00 is the end of the day
  return h > 23 || m > 59 ? null : { h, m }
}
const suffix = (h: number): string => (h >= 12 ? 'pm' : 'am')
const twelve = (h: number): number => (h % 12 === 0 ? 12 : h % 12)

// "18:00" -> "6:00 pm", "09:30:00" -> "9:30 am", "00:00" -> "12:00 am". Anything that is not a time is returned as it was.
export function fmtClock(t: string | null | undefined): string {
  const p = parts(t)
  return p ? `${twelve(p.h)}:${String(p.m).padStart(2, '0')} ${suffix(p.h)}` : String(t ?? '')
}

// "18:00","19:00" -> "6:00–7:00 pm"; across noon -> "11:30 am–12:30 pm".
export function fmtClockRange(a: string | null | undefined, b: string | null | undefined): string {
  const pa = parts(a), pb = parts(b)
  if (!pa || !pb) return `${fmtClock(a)}–${fmtClock(b)}`
  const left = suffix(pa.h) === suffix(pb.h) ? `${twelve(pa.h)}:${String(pa.m).padStart(2, '0')}` : fmtClock(a)
  return `${left}–${fmtClock(b)}`
}

// The "until 7:00" line on a ticket: the am/pm is left off when it is the same as the start time's.
export function fmtUntil(start: string | null | undefined, end: string | null | undefined): string {
  const ps = parts(start), pe = parts(end)
  if (!ps || !pe) return fmtClock(end)
  return suffix(ps.h) === suffix(pe.h) ? `${twelve(pe.h)}:${String(pe.m).padStart(2, '0')}` : fmtClock(end)
}

// A time in minutes since midnight ("1080" -> "6:00 pm").
export function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60) % 24, m = mins % 60
  return fmtClock(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
}

// Just the hour, for axis labels and hour rows: "18:00" -> "6 pm", "09:30" -> "9:30 am".
export function fmtHour(t: string | null | undefined): string {
  const p = parts(t)
  if (!p) return String(t ?? '')
  return p.m === 0 ? `${twelve(p.h)} ${suffix(p.h)}` : fmtClock(t)
}

// The clock time at a place, from an instant: ("2026-11-19T05:00:00Z", "Pacific/Auckland") -> "6:00 pm".
export function clockAt(when: number | string | Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(when))
  const h = parts.find(p => p.type === 'hour')?.value ?? '00', m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return fmtClock(`${h}:${m}`)
}
