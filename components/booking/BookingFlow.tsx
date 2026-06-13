'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate, getNextNDates, generateTimeSlots, addHours } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Court, Profile } from '@/types/database'
import { VENUES, type Venue } from '@/lib/venues'
import VenueSwitcher from '@/components/venue/VenueSwitcher'
import VenueLayout from '@/components/venue/VenueLayout'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const TIME_SLOTS = generateTimeSlots(7, 22, 60)

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return { day: DAYS[d.getDay()], num: d.getDate(), month: MONTHS[d.getMonth()] }
}

export default function BookingFlow({
  courts,
  profile,
  userId,
}: {
  courts: Court[]
  profile: Profile
  userId: string
}) {
  const supabase = createClient()
  const router = useRouter()

  const tier = profile?.membership_tier ?? 'casual'
  const memConfig = MEMBERSHIP_CONFIG[tier] ?? MEMBERSHIP_CONFIG['casual']
  const windowDays = memConfig.bookingWindowDays
  const dates = getNextNDates(windowDays)

  const [step, setStep] = useState(1)
  const [selectedVenue, setSelectedVenue] = useState<Venue>(VENUES[0])
  const [selectedDate, setSelectedDate] = useState(dates[0])
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [duration, setDuration] = useState<number>(1)
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [payMethod, setPayMethod] = useState<string>('card')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!selectedCourt || !selectedDate) return
    supabase
      .from('bookings')
      .select('start_time, duration_minutes')
      .eq('court_id', selectedCourt.id)
      .eq('date', selectedDate)
      .in('status', ['confirmed', 'blocked'])
      .then(({ data }) => {
        const taken: string[] = []
        ;(data ?? []).forEach((b: any) => {
          const startHour = parseInt(b.start_time.slice(0, 2))
          const hrs = (b.duration_minutes ?? 60) / 60
          for (let i = 0; i < hrs; i++) {
            const h = String(startHour + i).padStart(2, '0')
            taken.push(`${h}:00`)
          }
        })
        setTakenSlots(taken)
      })
  }, [selectedCourt?.id, selectedDate])

  const discount = memConfig.discount
  const courtPrice = selectedCourt
    ? selectedCourt.price_per_hour * (1 - discount) * duration
    : 0
  const userCredits = profile?.credits ?? 0
  const memberTier = profile?.membership_tier ?? 'casual'
  const memberName = profile?.full_name ?? 'You'

  const isSlotAvailable = (time: string) => {
    const startHour = parseInt(time.slice(0, 2))
    for (let i = 0; i < duration; i++) {
      const h = String(startHour + i).padStart(2, '0')
      if (takenSlots.includes(`${h}:00`)) return false
      if (startHour + i >= 22) return false
    }
    return true
  }

  const handleConfirm = async () => {
    if (!selectedCourt || !selectedTime || !userId) {
      toast.error('Please sign in to make a booking.')
      return
    }
    setSubmitting(true)
    const sb = supabase as any
    const { error } = await sb.from('bookings').insert({
      user_id: userId,
      court_id: selectedCourt.id,
      date: selectedDate,
      start_time: selectedTime + ':00',
      end_time: addHours(selectedTime, duration) + ':00',
      duration_minutes: duration * 60,
      status: 'confirmed',
      price_nzd: parseFloat(courtPrice.toFixed(2)),
      discount_applied: discount,
      payment_method: payMethod,
    })
    if (error) {
      toast.error(error.code === '23505'
        ? 'That slot was just taken — please choose another time.'
        : 'Booking failed: ' + error.message
      )
    } else {
      try {
        const user = await supabase.auth.getUser()
        await fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.data.user?.email,
            name: memberName,
            court: `${selectedCourt.name} — ${selectedCourt.type}`,
            date: formatDate(selectedDate),
            time: `${selectedTime} — ${addHours(selectedTime, duration)}`,
            duration: `${duration} hour${duration > 1 ? 's' : ''}`,
            total: formatNzd(courtPrice),
          }),
        })
      } catch {}
      toast.success('Court booked! Check your email.')
      router.push('/mybookings')
      router.refresh()
    }
    setSubmitting(false)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">

      <div className="flex items-center justify-center gap-2 mb-6">
        {['Court', 'Time', 'Confirm'].map((label, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={n} className="flex items-center gap-1">
              {i > 0 && (
                <div className="w-6 h-px" style={{ background: 'var(--border)' }} />
              )}
              <div className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                style={{ color: active || done ? 'var(--brand-primary)' : 'var(--text-subtle)' }}>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 transition-all"
                  style={{
                    background: active ? 'var(--brand-primary)' : done ? 'var(--brand-primary-muted)' : 'transparent',
                    border: `1px solid ${active || done ? 'var(--brand-primary)' : 'var(--border)'}`,
                    color: active ? 'var(--brand-primary-on)' : done ? 'var(--brand-primary)' : 'var(--text-subtle)',
                    boxShadow: active ? 'var(--glow-primary)' : 'none',
                  }}
                >
                  {done ? '✓' : n}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <>
          <VenueSwitcher selected={selectedVenue} onChange={setSelectedVenue} />
          <VenueLayout venue={selectedVenue} />
        </>
      )}

      {step === 1 && selectedVenue.isLive && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: 'var(--text-muted)' }}>Choose a date</h2>
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            {dates.map(d => {
              const { day, num, month } = dateLabel(d)
              const selected = selectedDate === d
              return (
                <button key={d} onClick={() => setSelectedDate(d)}
                  className="min-w-[52px] p-2 rounded-lg text-center transition-all shrink-0"
                  style={{
                    background: selected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                    border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border)'}`,
                    color: selected ? 'var(--brand-primary-on)' : 'var(--text-primary)',
                    boxShadow: selected ? 'var(--glow-primary)' : 'none',
                  }}>
                  <div className="text-[10px] opacity-75">{day}</div>
                  <div className="text-sm font-semibold leading-tight">{num}</div>
                  <div className="text-[10px] opacity-75">{month}</div>
                </button>
              )
            })}
          </div>

          <h2 className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: 'var(--text-muted)' }}>Choose a court</h2>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {courts.map(court => {
              const selected = selectedCourt?.id === court.id
              return (
                <div key={court.id} onClick={() => setSelectedCourt(court)}
                  className="cursor-pointer transition-all p-4 rounded-xl"
                  style={{
                    background: selected ? 'var(--brand-primary-muted)' : 'var(--bg-surface)',
                    border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border)'}`,
                    boxShadow: selected ? 'var(--glow-primary)' : 'none',
                  }}>
                  <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{court.name}</div>
                  <div className="text-xs my-1" style={{ color: 'var(--text-subtle)' }}>
                    {court.is_indoor ? '🏢' : '☀️'} {court.type}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>
                    {formatNzd(court.price_per_hour * (1 - discount))}/hr
                  </div>
                  {discount > 0 && (
                    <div className="text-xs" style={{ color: 'var(--brand-accent)' }}>
                      {(discount * 100).toFixed(0)}% off
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button className="btn btn-primary w-full justify-center"
            disabled={!selectedCourt} onClick={() => setStep(2)}>
            Next: pick a time →
          </button>
        </div>
      )}

      {step === 1 && !selectedVenue.isLive && (
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            {selectedVenue.region} is opening soon
          </div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            Online bookings for this venue aren't live yet — check back shortly, or book a court in Auckland for now.
          </div>
        </div>
      )}

      {step === 2 && selectedCourt && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{selectedCourt.name}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(selectedDate)}</div>
            </div>
            <button className="btn btn-sm" onClick={() => setStep(1)}>← Back</button>
          </div>

          <h2 className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: 'var(--text-muted)' }}>How long?</h2>
          <div className="flex gap-2 mb-5">
            {[1, 2, 3].map(h => {
              const selected = duration === h
              return (
                <button key={h} onClick={() => { setDuration(h); setSelectedTime(null) }}
                  className="flex-1 py-3 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: selected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                    border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border)'}`,
                    color: selected ? 'var(--brand-primary-on)' : 'var(--text-primary)',
                    boxShadow: selected ? 'var(--glow-primary)' : 'none',
                  }}>
                  {h} hour{h > 1 ? 's' : ''}
                  <div className="text-xs opacity-70 mt-0.5">
                    {formatNzd(selectedCourt.price_per_hour * (1 - discount) * h)}
                  </div>
                </button>
              )
            })}
          </div>

          <h2 className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: 'var(--text-muted)' }}>Choose a start time</h2>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {TIME_SLOTS.map(time => {
              const available = isSlotAvailable(time)
              const selected = selectedTime === time
              return (
                <button key={time} disabled={!available} onClick={() => setSelectedTime(time)}
                  className="p-2 rounded-lg text-center text-xs transition-all"
                  style={{
                    background: !available ? 'var(--bg-raised)' : selected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                    border: `1px solid ${!available ? 'transparent' : selected ? 'var(--brand-primary)' : 'var(--border)'}`,
                    color: !available ? 'var(--text-subtle)' : selected ? 'var(--brand-primary-on)' : 'var(--text-primary)',
                    cursor: !available ? 'not-allowed' : 'pointer',
                    boxShadow: selected ? 'var(--glow-primary)' : 'none',
                  }}>
                  {time}
                  <div className="text-[10px] opacity-70 mt-0.5">
                    {!available ? 'Taken' : `→ ${addHours(time, duration)}`}
                  </div>
                </button>
              )
            })}
          </div>
          <button className="btn btn-primary w-full justify-center"
            disabled={!selectedTime} onClick={() => setStep(3)}>
            Next: confirm →
          </button>
        </div>
      )}

      {step === 3 && selectedCourt && selectedTime && (
        <div>
          <div className="rounded-xl p-4 mb-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Booking summary</div>
            {[
              ['Court', `${selectedCourt.name} — ${selectedCourt.type}`],
              ['Date', formatDate(selectedDate)],
              ['Time', `${selectedTime} — ${addHours(selectedTime, duration)}`],
              ['Duration', `${duration} hour${duration > 1 ? 's' : ''}`],
              ['Member', memberName],
              ...(discount > 0 ? [['Discount', `${(discount * 100).toFixed(0)}% off`]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-1.5 text-sm last:border-0"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-medium text-right ml-2" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 mt-1">
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Total</span>
              <span className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>{formatNzd(courtPrice)}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Pay with</label>
            <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              <option value="card">Credit / debit card</option>
              {userCredits > 0 && (
                <option value="credits">Credits ({userCredits} remaining)</option>
              )}
              {memberTier !== 'casual' && (
                <option value="membership_allowance">Monthly allowance</option>
              )}
            </select>
          </div>

          <div className="flex gap-2">
            <button className="btn" onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn-primary flex-1 justify-center"
              disabled={submitting} onClick={handleConfirm}>
              {submitting ? 'Confirming…' : '✓ Confirm booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
