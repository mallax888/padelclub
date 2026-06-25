'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatNzd, formatDate, generateTimeSlots, addHours } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Court, Profile } from '@/types/database'
import { VENUES, type Venue } from '@/lib/venues'

const TIME_SLOTS = generateTimeSlots(7, 22, 60)
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const REGIONS = VENUES.map(v => v.region).filter((r, i, arr) => arr.indexOf(r) === i)

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return { day: DAYS[d.getDay()], num: d.getDate(), month: MONTHS[d.getMonth()] }
}

function StepReveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (show && ref.current) {
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [show])
  if (!show) return null
  return (
    <div ref={ref} className="animate-fade-in">
      {children}
    </div>
  )
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
  const discount = memConfig.discount
  const dates = Array.from({ length: memConfig.bookingWindowDays }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  // Progressive state
  const [region, setRegion] = useState<string | null>(null)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [court, setCourt] = useState<Court | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [makePublic, setMakePublic] = useState(false)
  const [matchType, setMatchType] = useState<'casual' | 'competitive'>('casual')
  const [matchNotes, setMatchNotes] = useState('')
  const [skillFilter, setSkillFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!court || !date) return
    const sb = supabase as any
    sb.from('bookings')
      .select('start_time, duration_minutes')
      .eq('court_id', court.id)
      .eq('date', date)
      .in('status', ['confirmed', 'blocked'])
      .then(({ data }: any) => {
        const taken: string[] = []
        ;(data ?? []).forEach((b: any) => {
          const startHour = parseInt(b.start_time.slice(0, 2))
          const hrs = (b.duration_minutes ?? 60) / 60
          for (let i = 0; i < hrs; i++) {
            taken.push(`${String(startHour + i).padStart(2, '0')}:00`)
          }
        })
        setTakenSlots(taken)
      })
  }, [court?.id, date])

  const isSlotAvailable = (t: string) => {
    if (!duration) return false
    const startHour = parseInt(t.slice(0, 2))
    for (let i = 0; i < duration; i++) {
      const h = String(startHour + i).padStart(2, '0')
      if (takenSlots.includes(`${h}:00`)) return false
      if (startHour + i >= 22) return false
    }
    return true
  }

  const courtPrice = court && duration ? court.price_per_hour * (1 - discount) * duration : 0

  const handleConfirm = async () => {
    if (!court || !time || !date || !userId) return
    setSubmitting(true)
    const sb = supabase as any

    const { data: bookingData, error } = await sb.from('bookings').insert({
      user_id: userId,
      court_id: court.id,
      date,
      start_time: time + ':00',
      end_time: addHours(time, duration!) + ':00',
      duration_minutes: duration! * 60,
      status: 'confirmed',
      price_nzd: parseFloat(courtPrice.toFixed(2)),
      discount_applied: discount,
      payment_method: 'card',
    }).select().single()

    if (error) {
      toast.error(error.code === '23505' ? 'That slot was just taken!' : error.message)
      setSubmitting(false)
      return
    }

    if (makePublic && bookingData) {
      const skillRanges = {
        all: { min: 0, max: 7 },
        beginner: { min: 0, max: 2.5 },
        intermediate: { min: 2.5, max: 4 },
        advanced: { min: 4, max: 7 },
      }
      const { min, max } = skillRanges[skillFilter]
      const { data: newMatch } = await sb.from('open_matches').insert({
        booking_id: bookingData.id,
        organizer_id: userId,
        venue_slug: venue?.slug ?? 'auckland-albany',
        court_id: court.id,
        date,
        start_time: time + ':00',
        end_time: addHours(time, duration!) + ':00',
        visibility: 'public',
        match_type: matchType,
        skill_min: min,
        skill_max: max,
        spots_total: 4,
        notes: matchNotes || null,
      }).select().single()

      if (newMatch) {
        await sb.from('open_match_players').insert({
          match_id: newMatch.id,
          player_id: userId,
          status: 'accepted',
        })
      }
    }

    // Stripe checkout
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: bookingData.id,
        courtName: court.name + ' — ' + court.type,
        date: formatDate(date),
        time: time + ' — ' + addHours(time, duration!),
        amount: courtPrice,
        splitCount: makePublic ? 4 : 1,
      }),
    })
    const { url, error: stripeError } = await res.json()
    if (stripeError) {
      toast.error(stripeError)
    } else {
      window.location.href = url
    }
    setSubmitting(false)
  }

  const regionVenues = region ? VENUES.filter(v => v.region === region) : []

  return (
    <div className="max-w-lg mx-auto px-1">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs mb-6 flex-wrap" style={{ color: 'var(--text-subtle)' }}>
        {[
          region,
          venue?.name,
          date ? formatDate(date) : null,
          court?.name,
          duration ? `${duration}hr` : null,
          time,
        ].filter(Boolean).map((item, i, arr) => (
          <span key={i} className="flex items-center gap-1.5">
            <span style={{ color: i === arr.length - 1 ? 'var(--brand-primary)' : 'var(--text-muted)' }}>{item}</span>
            {i < arr.length - 1 && <span>›</span>}
          </span>
        ))}
      </div>

      {/* STEP 1 — Region */}
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
          Where do you want to play?
        </div>
        <div className="grid grid-cols-2 gap-2">
          {REGIONS.map(r => {
            const venues = VENUES.filter(v => v.region === r)
            const courts = venues.reduce((s, v) => s + v.courts.length, 0)
            const isSelected = region === r
            return (
              <button key={r} onClick={() => { setRegion(r); setVenue(null); setDate(null); setCourt(null); setDuration(null); setTime(null) }}
                className="rounded-xl p-4 text-left transition-all"
                style={{
                  background: isSelected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                  border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                  boxShadow: isSelected ? 'var(--glow-primary)' : 'none',
                }}>
                <div className="text-sm font-semibold mb-1" style={{ color: isSelected ? 'var(--brand-primary-on)' : 'var(--text-primary)' }}>
                  {r}
                </div>
                <div className="text-xs" style={{ color: isSelected ? 'var(--brand-primary-on)' : 'var(--text-subtle)', opacity: 0.8 }}>
                  {venues.length} venue{venues.length > 1 ? 's' : ''} · {courts} courts
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* STEP 2 — Venue */}
      <StepReveal show={!!region}>
        <div className="mb-6">
          <div className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
            Which venue?
          </div>
          <div className="space-y-2">
            {regionVenues.map(v => {
              const isSelected = venue?.slug === v.slug
              return (
                <button key={v.slug} onClick={() => { setVenue(v); setDate(null); setCourt(null); setDuration(null); setTime(null) }}
                  className="w-full rounded-xl px-4 py-3 text-left transition-all flex items-center justify-between"
                  style={{
                    background: isSelected ? 'var(--brand-primary-muted)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                  }}>
                  <div>
                    <div className="text-sm font-medium" style={{ color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                      {v.name}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                      {v.address.split(',').slice(0,2).join(',')} · {v.courts.length} courts
                    </div>
                  </div>
                  {!v.isLive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}>
                      Soon
                    </span>
                  )}
                  {isSelected && (
                    <span style={{ color: 'var(--brand-primary)' }}>✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </StepReveal>

      {/* STEP 3 — Date */}
      <StepReveal show={!!venue}>
        <div className="mb-6">
          <div className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
            When?
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dates.map(d => {
              const { day, num, month } = dateLabel(d)
              const isSelected = date === d
              return (
                <button key={d} onClick={() => { setDate(d); setCourt(null); setDuration(null); setTime(null) }}
                  className="min-w-[52px] p-2 rounded-xl text-center transition-all shrink-0"
                  style={{
                    background: isSelected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                    color: isSelected ? 'var(--brand-primary-on)' : 'var(--text-primary)',
                    boxShadow: isSelected ? 'var(--glow-primary)' : 'none',
                  }}>
                  <div className="text-[10px] opacity-75">{day}</div>
                  <div className="text-sm font-semibold">{num}</div>
                  <div className="text-[10px] opacity-75">{month}</div>
                </button>
              )
            })}
          </div>
        </div>
      </StepReveal>

      {/* STEP 4 — Court */}
      <StepReveal show={!!date}>
        <div className="mb-6">
          <div className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
            Which court?
          </div>
          <div className="grid grid-cols-2 gap-2">
            {courts.map(c => {
              const isSelected = court?.id === c.id
              return (
                <button key={c.id} onClick={() => { setCourt(c); setDuration(null); setTime(null) }}
                  className="rounded-xl p-4 text-left transition-all"
                  style={{
                    background: isSelected ? 'var(--brand-primary-muted)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                  }}>
                  <div className="text-sm font-medium" style={{ color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                    {c.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                    {c.is_indoor ? '🏢' : '☀️'} {c.type}
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--brand-primary)' }}>
                    {formatNzd(c.price_per_hour * (1 - discount))}/hr
                    {discount > 0 && <span className="text-xs ml-1" style={{ color: 'var(--brand-accent)' }}>{(discount*100).toFixed(0)}% off</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </StepReveal>

      {/* STEP 5 — Duration */}
      <StepReveal show={!!court}>
        <div className="mb-6">
          <div className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
            How long?
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(h => {
              const isSelected = duration === h
              return (
                <button key={h} onClick={() => { setDuration(h); setTime(null) }}
                  className="rounded-xl py-3 text-center transition-all"
                  style={{
                    background: isSelected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                    color: isSelected ? 'var(--brand-primary-on)' : 'var(--text-primary)',
                    boxShadow: isSelected ? 'var(--glow-primary)' : 'none',
                  }}>
                  <div className="text-sm font-medium">{h} hour{h > 1 ? 's' : ''}</div>
                  {court && (
                    <div className="text-xs mt-0.5 opacity-75">
                      {formatNzd(court.price_per_hour * (1 - discount) * h)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </StepReveal>

      {/* STEP 6 — Time */}
      <StepReveal show={!!duration}>
        <div className="mb-6">
          <div className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
            What time?
          </div>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map(t => {
              const available = isSlotAvailable(t)
              const isSelected = time === t
              return (
                <button key={t} disabled={!available} onClick={() => setTime(t)}
                  className="p-2 rounded-lg text-center text-xs transition-all"
                  style={{
                    background: !available ? 'var(--bg-raised)' : isSelected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                    border: `1px solid ${!available ? 'transparent' : isSelected ? 'var(--brand-primary)' : 'var(--border)'}`,
                    color: !available ? 'var(--text-subtle)' : isSelected ? 'var(--brand-primary-on)' : 'var(--text-primary)',
                    cursor: !available ? 'not-allowed' : 'pointer',
                    boxShadow: isSelected ? 'var(--glow-primary)' : 'none',
                  }}>
                  {t}
                  <div className="text-[10px] mt-0.5 opacity-70">
                    {!available ? 'Taken' : duration ? `→ ${addHours(t, duration)}` : ''}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </StepReveal>

      {/* STEP 7 — Open match + confirm */}
      <StepReveal show={!!time}>
        <div className="mb-6">
          {/* Open match toggle */}
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>🎾 Open to other players?</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Let others find and join your game</div>
              </div>
              <button onClick={() => setMakePublic(!makePublic)}
                style={{
                  width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                  background: makePublic ? 'var(--brand-primary)' : 'var(--bg-raised)',
                  border: '1px solid var(--border)', position: 'relative', transition: 'background 0.15s',
                }}>
                <div style={{
                  position: 'absolute', top: 2, left: makePublic ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: makePublic ? 'var(--brand-primary-on)' : 'var(--text-subtle)',
                  transition: 'left 0.15s',
                }} />
              </button>
            </div>
            {makePublic && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  {(['casual', 'competitive'] as const).map(t => (
                    <button key={t} onClick={() => setMatchType(t)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all"
                      style={{
                        background: matchType === t ? 'var(--brand-primary)' : 'var(--bg-raised)',
                        color: matchType === t ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(s => (
                    <button key={s} onClick={() => setSkillFilter(s)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-all"
                      style={{
                        background: skillFilter === s ? 'var(--brand-primary)' : 'var(--bg-raised)',
                        color: skillFilter === s ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}>
                      {s === 'all' ? 'All levels' : s}
                    </button>
                  ))}
                </div>
                <input type="text" className="input text-sm" placeholder="Add a note (optional)"
                  value={matchNotes} onChange={e => setMatchNotes(e.target.value)} maxLength={100} />
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
              Booking summary
            </div>
            {[
              ['Venue', venue?.name],
              ['Court', court?.name + ' — ' + court?.type],
              ['Date', date ? formatDate(date) : ''],
              ['Time', time && duration ? time + ' — ' + addHours(time, duration) : ''],
              ['Duration', duration ? duration + ' hour' + (duration > 1 ? 's' : '') : ''],
              ...(discount > 0 ? [['Discount', (discount * 100).toFixed(0) + '% off']] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-1.5 text-sm"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-medium text-right ml-2" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3">
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Total</span>
              <span className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>{formatNzd(courtPrice)}</span>
            </div>
          </div>

          <button className="btn btn-primary w-full justify-center py-3 text-base"
            disabled={submitting} onClick={handleConfirm}>
            {submitting ? 'Confirming…' : `Pay ${formatNzd(courtPrice)} →`}
          </button>
        </div>
      </StepReveal>

    </div>
  )
}




