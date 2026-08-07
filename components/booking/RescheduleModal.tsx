'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'
import { generateTimeSlots, localDateStr } from '@/lib/utils'

const TIME_SLOTS = generateTimeSlots(7, 22, 30)

export default function RescheduleModal({
  bookingId,
  courtId,
  courtLabel,
  venueName,
  durationMinutes,
  bookingWindowDays,
  onClose,
  onRescheduled,
}: {
  bookingId: string
  courtId: string
  courtLabel: string
  venueName: string
  durationMinutes: number
  bookingWindowDays: number
  onClose: () => void
  onRescheduled: () => void
}) {
  const supabase = createClient()
  const minDate = localDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000))
  const maxDate = localDateStr(new Date(Date.now() + bookingWindowDays * 24 * 60 * 60 * 1000))

  const [date, setDate] = useState(minDate)
  const [time, setTime] = useState<string | null>(null)
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setTime(null)
    supabase
      .from('bookings')
      .select('start_time, duration_minutes')
      .eq('court_id', courtId)
      .eq('date', date)
      .in('status', ['confirmed', 'blocked'])
      .neq('id', bookingId)
      .then(({ data }: any) => {
        const taken: string[] = []
        ;(data ?? []).forEach((b: any) => {
          const startHour = parseInt(b.start_time.slice(0, 2))
          const startMin = parseInt(b.start_time.slice(3, 5))
          const startTotal = startHour * 60 + startMin
          for (let m = 0; m < (b.duration_minutes ?? 60); m += 30) {
            const t = startTotal + m
            taken.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
          }
        })
        setTakenSlots(taken)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, courtId])

  const isSlotAvailable = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const startTotal = h * 60 + m
    for (let offset = 0; offset < durationMinutes; offset += 30) {
      const cur = startTotal + offset
      if (Math.floor(cur / 60) >= 22) return false
      const curT = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`
      if (takenSlots.includes(curT)) return false
    }
    return true
  }

  const handleConfirm = async () => {
    if (!time) return
    setSubmitting(true)
    const res = await fetch('/api/reschedule-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, newDate: date, newStartTime: time }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Could not reschedule — please try again.')
      return
    }
    toast.success('Booking rescheduled.')
    onRescheduled()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>Reschedule booking</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{courtLabel} · {venueName}</div>

        <label className="block text-xs font-bold mt-4 mb-1.5" style={{ color: 'var(--text-muted)' }}>New date</label>
        <input
          type="date"
          value={date}
          min={minDate}
          max={maxDate}
          onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />

        <label className="block text-xs font-bold mt-4 mb-1.5" style={{ color: 'var(--text-muted)' }}>New time</label>
        <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
          {TIME_SLOTS.map(t => {
            const available = isSlotAvailable(t)
            const selected = t === time
            return (
              <button
                key={t}
                type="button"
                disabled={!available}
                onClick={() => setTime(t)}
                className="text-xs font-semibold py-1.5 rounded-lg"
                style={{
                  background: selected ? 'var(--brand-primary)' : 'var(--bg-raised)',
                  color: selected ? 'var(--brand-primary-on)' : available ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: '1px solid ' + (selected ? 'var(--brand-primary)' : 'var(--border)'),
                  opacity: available ? 1 : 0.4,
                  cursor: available ? 'pointer' : 'not-allowed',
                }}
              >
                {t}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="flex-1 text-sm font-bold py-2.5 rounded-xl" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!time || submitting}
            className="flex-1 text-sm font-bold py-2.5 rounded-xl"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', opacity: !time || submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
