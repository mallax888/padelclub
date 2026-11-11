'use client'

import { useEffect, useState } from 'react'
import { summariseRegulars, type SummaryBooking } from '@/lib/regulars-rules'
import { timezoneForVenueSlug } from '@/lib/timezone'

const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' } as const
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// What this club's weekly regulars hold, on the Board. Shows nothing until a
// club has at least one regular, so clubs that don't use them see no change.
export default function RegularsSummaryCard({ venueSlug, bookings, courtCount }: { venueSlug: string; bookings: SummaryBooking[]; courtCount: number }) {
  // "Now" only exists in the browser; reading the clock while rendering on the
  // server would disagree with the client and trip hydration.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])
  if (now === null) return null
  const s = summariseRegulars(bookings, timezoneForVenueSlug(venueSlug), now)
  if (s.regulars === 0) return null
  return (
    <div className="rounded-2xl p-5" style={card} data-testid="regulars-summary">
      <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: 'var(--text-subtle)' }}>🔁 Regulars</div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display), Manrope, sans-serif', color: 'var(--text-primary)' }}>{s.regulars}</span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{s.regulars === 1 ? 'weekly regular holds' : 'weekly regulars hold'} {s.hoursPerWeek} {s.hoursPerWeek === 1 ? 'hour' : 'hours'} a week</span>
      </div>
      <div className="mt-3">
        {s.slots.map(slot => (
          <div key={`${slot.weekday}-${slot.time}`} className="flex items-center justify-between py-2 text-sm" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-primary)' }}>{WEEKDAYS[slot.weekday]} {slot.time}</span>
            <span className="font-semibold" style={{ color: slot.courts >= courtCount ? 'var(--brand-primary-text)' : 'var(--text-muted)' }}>
              {slot.courts} {slot.courts === 1 ? 'court' : 'courts'} held{slot.courts >= courtCount ? ' · full' : ''}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between py-2 text-sm" style={{ borderTop: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-primary)' }}>Let go in the next 7 days</span>
          <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>{s.skippedSoon}</span>
        </div>
      </div>
    </div>
  )
}
