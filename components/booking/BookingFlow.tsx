'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatNzd, formatDate, getNextNDates, generateTimeSlots, addHours } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Court, Profile } from '@/types/database'

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
  const [selectedDate, setSelectedDate] = useState(dates[0])
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [payMethod, setPayMethod] = useState<string>('card')
  const [duration, setDuration] = useState<number>(1)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!selectedCourt || !selectedDate) return
    supabase
      .from('bookings')
      .select('start_time')
      .eq('court_id', selectedCourt.id)
      .eq('date', selectedDate)
      .in('status', ['confirmed', 'blocked'])
      .then(({ data }) => {
        setTakenSlots((data ?? []).map((b: any) => b.start_time.slice(0, 5)))
      })
  }, [selectedCourt?.id, selectedDate])

  const discount = memConfig.discount
  const courtPrice = selectedCourt ? selectedCourt.price_per_hour * (1 - discount) * duration : 0
  const userCredits = profile?.credits ?? 0
  const memberTier = profile?.membership_tier ?? 'casual'
  const memberName = profile?.full_name ?? 'You'

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
      toast.success('Court booked!')
      router.push('/mybookings')
      router.refresh()
    }
    setSubmitting(false)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">

      <div className="flex items-center justify-center gap-2 mb-6">
        {['Court','Time','Confirm'].map((label, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={n} className="flex items-center gap-1">
              {i > 0 && <div className="w-6 h-px bg-gray-200" />}
              <div className={cn(
                'flex items-center gap-1 text-xs font-medium',
                active && 'text-gray-900',
                done && 'text-brand-600',
                !active && !done && 'text-gray-400'
              )}>
                <div className={cn(
                  'w-5 h-5 rounded-full border flex items-center justify-center text-xs shrink-0',
                  active && 'bg-brand-400 border-brand-400 text-white',
                  done && 'bg-brand-50 border-brand-400 text-brand-600',
                  !active && !done && 'border-gray-300 text-gray-400'
                )}>
                  {done ? '✓' : n}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <div>
          <h2 className="text-sm font-medium text-gray-600 mb-2">Choose a date</h2>
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            {dates.map(d => {
              const { day, num, month } = dateLabel(d)
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    'min-w-[52px] p-2 rounded-lg border text-center transition-all shrink-0',
                    selectedDate === d
                      ? 'bg-brand-400 border-brand-400 text-white'
                      : 'bg-white border-gray-200'
                  )}
                >
                  <div className="text-[10px] opacity-75">{day}</div>
                  <div className="text-sm font-semibold leading-tight">{num}</div>
                  <div className="text-[10px] opacity-75">{month}</div>
                </button>
              )
            })}
          </div>

          <h2 className="text-sm font-medium text-gray-600 mb-2">Choose a court</h2>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {courts.map(court => (
              <div
                key={court.id}
                onClick={() => setSelectedCourt(court)}
                className={cn(
                  'card cursor-pointer transition-all p-3',
                  selectedCourt?.id === court.id
                    ? 'border-brand-400 ring-2 ring-brand-50'
                    : 'hover:border-brand-400'
                )}
              >
                <div className="font-medium text-sm">{court.name}</div>
                <div className="text-xs text-gray-400 my-1">
                  {court.is_indoor ? '🏢' : '☀️'} {court.type}
                </div>
                <div className="text-sm font-semibold text-brand-600">
                  {formatNzd(court.price_per_hour * (1 - discount))}/hr
                </div>
                {discount > 0 && (
                  <div className="text-xs text-brand-400">{(discount*100).toFixed(0)}% off</div>
                )}
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary w-full justify-center"
            disabled={!selectedCourt}
            onClick={() => setStep(2)}
          >
            Next: pick a time →
          </button>
        </div>
      )}

      {step === 2 && selectedCourt && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-medium text-sm">{selectedCourt.name}</div>
              <div className="text-xs text-gray-500">{formatDate(selectedDate)} · {formatNzd(courtPrice)}/hr</div>
            </div>
            <button className="btn btn-sm" onClick={() => setStep(1)}>← Back</button>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-5">
            {TIME_SLOTS.map(time => {
              const taken = takenSlots.includes(time)
              const selected = selectedTime === time
              return (
                <button
                  key={time}
                  disabled={taken}
                  onClick={() => setSelectedTime(time)}
                  className={cn(
                    'p-2 rounded-lg border text-center text-xs transition-all',
                    taken && 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-100',
                    selected && 'bg-brand-400 text-white border-brand-400',
                    !taken && !selected && 'bg-white border-gray-200 hover:border-brand-400'
                  )}
                >
                  {time}
                  <div className="text-[10px] opacity-70 mt-0.5">{taken ? 'Taken' : '1hr'}</div>
                </button>
              )
            })}
          </div>

          <button
            className="btn btn-primary w-full justify-center"
            disabled={!selectedTime}
            onClick={() => setStep(3)}
          >
            Next: confirm →
          </button>
        </div>
      )}

      {step === 3 && selectedCourt && selectedTime && (
        <div>
          <div className="card mb-4 p-4">
            <div className="font-medium mb-3">Booking summary</div>
            {[
              ['Court', `${selectedCourt.name} — ${selectedCourt.type}`],
              ['Date', formatDate(selectedDate)],
              ['Time', `${selectedTime} – ${addHours(selectedTime, duration)}`],
['Duration', `${duration} hour${duration > 1 ? 's' : ''}`],
              ['Member', memberName],
              ...(discount > 0 ? [['Discount', `${(discount*100).toFixed(0)}% off`]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-gray-100 text-sm last:border-0">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-right ml-2">{value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-1">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold text-brand-600">{formatNzd(courtPrice)}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Duration</label>
            <select className="input" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={3}>3 hours</option>
            </select>
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