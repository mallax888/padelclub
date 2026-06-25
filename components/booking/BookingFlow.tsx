'use client'

import { useState, useEffect } from 'react'
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

type Step = 'region' | 'venue' | 'date' | 'court' | 'duration' | 'time' | 'confirm'
const STEPS: Step[] = ['region', 'venue', 'date', 'court', 'duration', 'time', 'confirm']

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
  const discount = memConfig.discount
  const dates = Array.from({ length: memConfig.bookingWindowDays }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const [step, setStep] = useState<Step>('region')
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

  const goBack = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  const handleConfirm = async () => {
    if (!court || !time || !date || !userId || !duration) return
    setSubmitting(true)
    const sb = supabase as any

    const { data: bookingData, error } = await sb.from('bookings').insert({
      user_id: userId,
      court_id: court.id,
      date,
      start_time: time + ':00',
      end_time: addHours(time, duration) + ':00',
      duration_minutes: duration * 60,
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
        end_time: addHours(time, duration) + ':00',
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

    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: bookingData.id,
        courtName: court.name + ' — ' + court.type,
        date: formatDate(date),
        time: time + ' — ' + addHours(time, duration),
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

  // Step titles and subtitles
  const stepMeta: Record<Step, { title: string; subtitle?: string }> = {
    region:   { title: 'Where do you want to play?' },
    venue:    { title: 'Choose a venue', subtitle: region ?? '' },
    date:     { title: 'When?', subtitle: venue?.name ?? '' },
    court:    { title: 'Which court?', subtitle: date ? formatDate(date) : '' },
    duration: { title: 'How long?', subtitle: court?.name ?? '' },
    time:     { title: 'What time?', subtitle: duration ? `${duration} hour${duration > 1 ? 's' : ''}` : '' },
    confirm:  { title: 'Confirm booking', subtitle: time ?? '' },
  }

  return (
    <div className="max-w-lg mx-auto">

      {/* Back arrow + step title */}
      <div className="flex items-center gap-3 mb-6">
        {step !== 'region' && (
          <button onClick={goBack}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {stepMeta[step].title}
          </h2>
          {stepMeta[step].subtitle && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {stepMeta[step].subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="h-1 flex-1 rounded-full transition-all"
            style={{
              background: i <= STEPS.indexOf(step) ? 'var(--brand-primary)' : 'var(--bg-raised)',
            }} />
        ))}
      </div>

      {/* STEP: Region */}
      {step === 'region' && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          {REGIONS.map(r => {
            const venues = VENUES.filter(v => v.region === r)
            const totalCourts = venues.reduce((s, v) => s + v.courts.length, 0)
            const hasLive = venues.some(v => v.isLive)
            return (
              <button key={r}
                onClick={() => { setRegion(r); setVenue(null); setDate(null); setCourt(null); setDuration(null); setTime(null); setStep('venue') }}
                className="rounded-xl p-5 text-left transition-all"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div className="text-2xl mb-2">📍</div>
                <div className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{r}</div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {venues.length} venue{venues.length > 1 ? 's' : ''} · {totalCourts} courts
                </div>
                {!hasLive && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full mt-2 inline-block"
                    style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}>
                    Coming soon
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* STEP: Venue */}
      {step === 'venue' && (
        <div className="space-y-2 animate-fade-in">
          {regionVenues.map(v => (
            <button key={v.slug}
              onClick={() => { setVenue(v); setDate(null); setCourt(null); setDuration(null); setTime(null); setStep('date') }}
              className="w-full rounded-xl px-4 py-4 text-left transition-all flex items-center justify-between"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{v.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {v.address.split(',').slice(0,2).join(',')}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {v.courts.length} courts
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {!v.isLive && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}>
                    Soon
                  </span>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-subtle)' }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STEP: Date */}
      {step === 'date' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-4 gap-2">
            {dates.map(d => {
              const { day, num, month } = dateLabel(d)
              return (
                <button key={d}
                  onClick={() => { setDate(d); setCourt(null); setDuration(null); setTime(null); setStep('court') }}
                  className="rounded-xl p-3 text-center transition-all"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.color = 'var(--brand-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                >
                  <div className="text-[10px] opacity-60">{day}</div>
                  <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{num}</div>
                  <div className="text-[10px] opacity-60">{month}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* STEP: Court */}
      {step === 'court' && (
        <div className="space-y-2 animate-fade-in">
          {courts.map(c => (
            <button key={c.id}
              onClick={() => { setCourt(c); setDuration(null); setTime(null); setStep('duration') }}
              className="w-full rounded-xl px-4 py-4 text-left transition-all flex items-center justify-between"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {c.is_indoor ? '🏢' : '☀️'} {c.type}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold" style={{ color: 'var(--brand-primary)' }}>
                  {formatNzd(c.price_per_hour * (1 - discount))}/hr
                </div>
                {discount > 0 && (
                  <div className="text-xs" style={{ color: 'var(--brand-accent)' }}>
                    {(discount * 100).toFixed(0)}% off
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STEP: Duration */}
      {step === 'duration' && (
        <div className="grid grid-cols-3 gap-3 animate-fade-in">
          {[1, 2, 3].map(h => (
            <button key={h}
              onClick={() => { setDuration(h); setTime(null); setStep('time') }}
              className="rounded-xl p-5 text-center transition-all"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{h}h</div>
              {court && (
                <div className="text-xs" style={{ color: 'var(--brand-primary)' }}>
                  {formatNzd(court.price_per_hour * (1 - discount) * h)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* STEP: Time */}
      {step === 'time' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-3 gap-2">
            {TIME_SLOTS.map(t => {
              const available = isSlotAvailable(t)
              return (
                <button key={t} disabled={!available}
                  onClick={() => { setTime(t); setStep('confirm') }}
                  className="rounded-xl p-3 text-center transition-all"
                  style={{
                    background: !available ? 'var(--bg-raised)' : 'var(--bg-surface)',
                    border: `1px solid ${!available ? 'transparent' : 'var(--border)'}`,
                    color: !available ? 'var(--text-subtle)' : 'var(--text-primary)',
                    cursor: !available ? 'not-allowed' : 'pointer',
                    opacity: !available ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (available) e.currentTarget.style.borderColor = 'var(--brand-primary)' }}
                  onMouseLeave={e => { if (available) e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div className="text-sm font-semibold">{t}</div>
                  {available && duration && (
                    <div className="text-[10px] mt-0.5 opacity-60">→ {addHours(t, duration)}</div>
                  )}
                  {!available && <div className="text-[10px] mt-0.5">Taken</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* STEP: Confirm */}
      {step === 'confirm' && (
        <div className="animate-fade-in">
          {/* Summary card */}
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            {[
              ['Venue', venue?.name],
              ['Court', court?.name + ' — ' + court?.type],
              ['Date', date ? formatDate(date) : ''],
              ['Time', time && duration ? time + ' — ' + addHours(time, duration) : ''],
              ['Duration', duration ? duration + ' hour' + (duration > 1 ? 's' : '') : ''],
              ...(discount > 0 ? [['Discount', (discount * 100).toFixed(0) + '% off']] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 text-sm"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-medium text-right ml-4" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3">
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Total</span>
              <span className="text-xl font-bold" style={{ color: 'var(--brand-primary)' }}>{formatNzd(courtPrice)}</span>
            </div>
          </div>

          {/* Open match toggle */}
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
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
                      className="flex-1 py-2 rounded-lg text-xs font-medium capitalize"
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
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize"
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

          <button className="w-full py-4 rounded-xl text-base font-semibold transition-all"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
            disabled={submitting} onClick={handleConfirm}>
            {submitting ? 'Confirming…' : `Pay ${formatNzd(courtPrice)} →`}
          </button>
        </div>
      )}

    </div>
  )
}
