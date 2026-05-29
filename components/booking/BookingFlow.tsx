'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate, getNextNDates, generateTimeSlots, addHours } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Court, Profile, Booking } from '@/types/database'

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
}: {
  courts: Court[]
  profile: Profile
}) {
  const supabase = createClient()
  const router = useRouter()

  const memConfig = MEMBERSHIP_CONFIG[profile?.membership_tier ?? 'casual'] ?? MEMBERSHIP_CONFIG['casual']
  const windowDays = memConfig.bookingWindowDays
  const dates = getNextNDates(windowDays)

  const [step, setStep] = useState(1)
  const [selectedDate, setSelectedDate] = useState(dates[0])
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [payMethod, setPayMethod] = useState<string>('card')
  const [submitting, setSubmitting] = useState(false)

  // Fetch taken slots whenever court or date changes
  useEffect(() => {
    if (!selectedCourt || !selectedDate) return
    supabase
      .from('bookings')
      .select('start_time')
      .eq('court_id', selectedCourt.id)
      .eq('date', selectedDate)
      .in('status', ['confirmed', 'blocked'])
      .then(({ data }) => {
        setTakenSlots((data ?? []).map(b => b.start_time.slice(0, 5)))
      })
  }, [selectedCourt?.id, selectedDate])

  const discount = memConfig.discount
  const courtPrice = selectedCourt ? selectedCourt.price_per_hour * (1 - discount) : 0

  const handleConfirm = async () => {
    if (!selectedCourt || !selectedTime) return
    setSubmitting(true)

    const { error } = await (supabase as any).from('bookings').insert({
      user_id: profile?.id,
      court_id: selectedCourt.id,
      date: selectedDate,
      start_time: selectedTime + ':00',
      end_time: addHours(selectedTime, 1) + ':00',
      duration_minutes: 60,
      status: 'confirmed',
      price_nzd: parseFloat(courtPrice.toFixed(2)),
      discount_applied: discount,
      payment_method: payMethod as 'card' | 'credits' | 'membership_allowance',
    })

    if (error) {
      toast.error(error.code === '23505'
        ? 'That slot was just taken — please choose another time.'
        : error.message
      )
    } else {
      toast.success('Court booked!')
      router.push('/mybookings')
      router.refresh()
    }
    setSubmitting(false)
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['Select court','Pick time','Confirm'].map((label, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={n} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-gray-200" />}
              <div className={cn(
                'flex items-center gap-2 text-sm',
                active && 'text-gray-900 font-medium',
                done && 'text-brand-600',
                !active && !done && 'text-gray-400'
              )}>
                <div className={cn(
                  'w-6 h-6 rounded-full border flex items-center justify-center text-xs',
                  active && 'bg-brand-400 border-brand-400 text-white',
                  done && 'bg-brand-50 border-brand-400 text-brand-600',
                  !active && !done && 'border-gray-300 text-gray-400'
                )}>
                  {done ? '✓' : n}
                </div>
                {label}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── STEP 1: Date + Court ── */}
      {step === 1 && (
        <div>
          {/* Date strip */}
          <h2 className="text-sm font-medium text-gray-700 mb-3">Choose a date</h2>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {dates.map(d => {
              const { day, num, month } = dateLabel(d)
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    'min-w-[56px] p-2 rounded-lg border text-center transition-all',
                    selectedDate === d
                      ? 'bg-brand-400 border-brand-400 text-white'
                      : 'bg-white border-gray-200 hover:border-brand-400'
                  )}
                >
                  <div className="text-[10px] opacity-75">{day}</div>
                  <div className="text-base font-medium leading-tight">{num}</div>
                  <div className="text-[10px] opacity-75">{month}</div>
                </button>
              )
            })}
          </div>

          {/* Courts */}
          <h2 className="text-sm font-medium text-gray-700 mb-3">Choose a court</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {courts.map(court => (
              <div
                key={court.id}
                onClick={() => setSelectedCourt(court)}
                className={cn(
                  'card cursor-pointer transition-all hover:border-brand-400',
                  selectedCourt?.id === court.id && 'border-brand-400 ring-2 ring-brand-50'
                )}
              >
                <div className="font-medium text-sm mb-0.5">{court.name}</div>
                <div className="text-xs text-gray-400 mb-3">
                  {court.is_indoor ? '🏢' : '☀️'} {court.type}
                </div>
                <div className="text-sm font-medium text-brand-600">
                  {formatNzd(court.price_per_hour * (1 - discount))}/hr
                  {discount > 0 && (
                    <span className="text-xs text-brand-400 ml-1">({(discount*100).toFixed(0)}% off)</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              disabled={!selectedCourt}
              onClick={() => setStep(2)}
            >
              Next: pick a time →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Time slot ── */}
      {step === 2 && selectedCourt && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-medium">{selectedCourt.name} — {selectedCourt.type}</div>
              <div className="text-sm text-gray-500">{formatDate(selectedDate)} · {formatNzd(courtPrice)}/hr</div>
            </div>
            <button className="btn btn-sm" onClick={() => setStep(1)}>← Back</button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 mb-6">
            {TIME_SLOTS.map(time => {
              const taken = takenSlots.includes(time)
              const selected = selectedTime === time
              return (
                <button
                  key={time}
                  disabled={taken}
                  onClick={() => setSelectedTime(time)}
                  className={cn(
                    'slot',
                    taken && 'slot-taken',
                    selected && 'slot-selected'
                  )}
                >
                  {time}
                  <div className="text-[10px] opacity-70 mt-0.5">{taken ? 'Taken' : '1 hr'}</div>
                </button>
              )
            })}
          </div>

          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              disabled={!selectedTime}
              onClick={() => setStep(3)}
            >
              Next: confirm →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Confirm ── */}
      {step === 3 && selectedCourt && selectedTime && (
        <div className="max-w-md">
          <div className="card mb-4">
            <div className="font-medium mb-4">Booking summary</div>
            {[
              ['Court', `${selectedCourt.name} — ${selectedCourt.type}`],
              ['Date', formatDate(selectedDate)],
              ['Time', `${selectedTime} – ${addHours(selectedTime, 1)}`],
              ['Duration', '1 hour'],
              ['Member', profile?.full_name ?? 'You'],
              ...(discount > 0 ? [['Discount', `${(discount*100).toFixed(0)}% (${memConfig.name} member)`]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-100 text-sm last:border-0">
                <span className="text-gray-500">{label}</span>
                <span className={cn('font-medium', label === 'Discount' && 'text-brand-600')}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3">
              <span className="font-medium">Total</span>
              <span className="text-lg font-semibold text-brand-600">{formatNzd(courtPrice)}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Pay with</label>
            <select
              className="input"
              value={payMethod}
              onChange={e => setPayMethod(e.target.value)}
            >
              <option value="card">Credit / debit card</option>
              {profile?.credits ?? 0 > 0 && (
                <option value="credits">Session credits ({profile?.credits ?? 0} remaining)</option>
              )}
              {profile?.membership_tier ?? 'casual' !== 'casual' && (
                <option value="membership_allowance">Monthly allowance</option>
              )}
            </select>
          </div>

          <div className="flex gap-3">
            <button className="btn" onClick={() => setStep(2)}>← Back</button>
            <button
              className="btn btn-primary flex-1 justify-center"
              disabled={submitting}
              onClick={handleConfirm}
            >
              {submitting ? 'Confirming…' : '✓ Confirm booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
