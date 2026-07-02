'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatNzd, formatDate, generateTimeSlots, addHours } from '@/lib/utils'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Court, Profile } from '@/types/database'
import { VENUES, type Venue } from '@/lib/venues'
import { playSelectionSound, playBackSound } from '@/lib/sounds'

const TIME_SLOTS = generateTimeSlots(7, 22, 30)
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const COUNTRIES = [
  { name: 'New Zealand', flag: 'https://flagcdn.com/w80/nz.png', regions: ['Auckland', 'Wellington', 'Christchurch'] },
  { name: 'South Africa', flag: 'https://flagcdn.com/w80/za.png', regions: ['Nelspruit', 'Johannesburg', 'Cape Town', 'Durban', 'Pretoria'] },
  { name: 'Australia', flag: 'https://flagcdn.com/w80/au.png', regions: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'] },
]
const REGIONS = VENUES.map(v => v.region).filter((r, i, arr) => arr.indexOf(r) === i)

const DURATIONS = [
  { value: 0.5, label: '30 min'  },
  { value: 1,   label: '60 min'  },
  { value: 1.5, label: '90 min'  },
  { value: 2,   label: '120 min' },
]

function isPeakTime(dateStr: string | null, timeStr: string | null): boolean {
  if (!dateStr || !timeStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const hour = parseInt(timeStr.slice(0, 2))
  const isWeekend = day === 0 || day === 6
  const isEvening = hour >= 17 && hour < 21
  return isWeekend || isEvening
}

function durationLabel(d: number) {
  if (d === 0.5) return '30 min'
  if (d === 1)   return '60 min'
  if (d === 1.5) return '90 min'
  return '120 min'
}

type Step = 'country' | 'region' | 'venue' | 'date' | 'court' | 'duration' | 'time' | 'confirm'
const STEPS: Step[] = ['country', 'region', 'venue', 'date', 'court', 'duration', 'time', 'confirm']

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return { day: DAYS[d.getDay()], num: d.getDate(), month: MONTHS[d.getMonth()] }
}

export default function BookingFlow({
    courts,
    profile,
    userId,
    allPlayers = [],
    lastVenueSlug = null,
  }: {
    courts: Court[]
    profile: Profile
    userId: string
    allPlayers?: { id: string; full_name: string | null; nickname: string | null }[]
    lastVenueSlug?: string | null
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

  const initialVenue = lastVenueSlug ? VENUES.find(v => v.slug === lastVenueSlug) ?? null : null
  const initialCountry = initialVenue ? COUNTRIES.find(c => c.regions.includes(initialVenue.region))?.name ?? null : null
  const [step, setStep] = useState<Step>(initialVenue ? 'date' : 'country')
  const [country, setCountry] = useState<string | null>(initialCountry)
  const [region, setRegion] = useState<string | null>(initialVenue?.region ?? null)
  const [venue, setVenue] = useState<Venue | null>(initialVenue)
  const [date, setDate] = useState<string | null>(null)
  const [court, setCourt] = useState<Court | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [makePublic, setMakePublic] = useState(false)
  const [matchType, setMatchType] = useState<'casual' | 'competitive'>('casual')
  const [matchNotes, setMatchNotes] = useState('')
  const [skillFilter, setSkillFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitPlayers, setSplitPlayers] = useState<string[]>([])
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
          const startMin = parseInt(b.start_time.slice(3, 5))
          const totalMins = (b.duration_minutes ?? 60)
          const startTotal = startHour * 60 + startMin
          for (let m = 0; m < totalMins; m += 30) {
            const t = startTotal + m
            const h = String(Math.floor(t / 60)).padStart(2, '0')
            const min = String(t % 60).padStart(2, '0')
            taken.push(`${h}:${min}`)
          }
        })
        setTakenSlots(taken)
      })
  }, [court?.id, date])

  const isSlotAvailable = (t: string) => {
    if (!duration) return false
    const [h, m] = t.split(':').map(Number)
    const startTotal = h * 60 + m
    const totalMins = duration * 60
    for (let offset = 0; offset < totalMins; offset += 30) {
      const cur = startTotal + offset
      const curH = String(Math.floor(cur / 60)).padStart(2, '0')
      const curM = String(cur % 60).padStart(2, '0')
      if (takenSlots.includes(`${curH}:${curM}`)) return false
      if (Math.floor(cur / 60) >= 22) return false
    }
    return true
  }

  const isPeak = isPeakTime(date, time)
  const basePrice = court
    ? (isPeak && (court as any).price_per_hour_peak
        ? (court as any).price_per_hour_peak
        : court.price_per_hour)
    : 0
  const courtPrice = court && duration ? basePrice * (1 - discount) * duration : 0

  const goBack = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  const addHoursDecimal = (timeStr: string, hrs: number) => {
    const [h, m] = timeStr.split(':').map(Number)
    const totalMins = h * 60 + m + hrs * 60
    return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`
  }

  const handleConfirm = async () => {
    if (!court || !time || !date || !userId || !duration) return
    setSubmitting(true)
    const sb = supabase as any
    const endTime = addHoursDecimal(time, duration)

    const { data: bookingData, error } = await sb.from('bookings').insert({
      user_id: userId,
      court_id: court.id,
      date,
      start_time: time + ':00',
      end_time: endTime + ':00',
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
        end_time: endTime + ':00',
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

    if (splitEnabled && splitPlayers.length > 0 && bookingData) {
      const splitAmount = parseFloat((courtPrice / (splitPlayers.length + 1)).toFixed(2))
      for (const pid of splitPlayers) {
        await sb.from('booking_splits').insert({
          booking_id: bookingData.id,
          invited_by: userId,
          user_id: pid,
          amount_nzd: splitAmount,
          status: 'pending',
        })
        await sb.from('notifications').insert({
          user_id: pid,
          type: 'split_request',
          title: 'Court cost split',
          message: (profile?.full_name ?? 'Someone') + ' is requesting ' + formatNzd(splitAmount) + ' for a court booking.',
          data: JSON.stringify({ booking_id: bookingData.id, amount: splitAmount }),
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
        time: time + ' — ' + endTime,
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
  const countryFilteredRegions = country ? REGIONS.filter(r => COUNTRIES.find(c => c.name === country)?.regions.includes(r)) : REGIONS



  const stepMeta: Record<Step, { title: string; subtitle?: string }> = {
    country:  { title: 'Where are you based?' },
    region:   { title: 'Choose a city', subtitle: country ?? '' },
    venue:    { title: 'Choose a venue', subtitle: region ?? '' },
    date:     { title: 'When?', subtitle: venue?.name ?? '' },
    court:    { title: 'Which court?', subtitle: date ? formatDate(date) : '' },
    duration: { title: 'How long?', subtitle: court?.name ?? '' },
    time:     { title: 'What time?', subtitle: duration ? durationLabel(duration) : '' },
    confirm:  { title: 'Confirm booking' },
  }

  return (
    <div className="max-w-lg mx-auto">

      {/* Back arrow + step title */}
      <div className="flex items-center gap-3 mb-6">
        {step !== 'country' && (
          <button onClick={() => { goBack(); playBackSound() }}
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

      {/* Progress bar */}
      <div className="flex gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="h-1 flex-1 rounded-full transition-all"
            style={{ background: i <= STEPS.indexOf(step) ? 'var(--brand-primary)' : 'rgba(128,128,128,0.35)' }} />
        ))}
      </div>

      {/* STEP: Country */}
      {step === 'country' && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          {COUNTRIES.map(c => (
            <button key={c.name}
              onClick={() => { setCountry(c.name); setRegion(null); setVenue(null); setDate(null); setCourt(null); setDuration(null); setTime(null); setStep('region'); playSelectionSound() }}
              className="rounded-xl p-5 transition-all flex flex-col items-center gap-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', minHeight: 180, height: 180, position: 'relative' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <img src={c.flag} alt={c.name} style={{ width: 80, height: 53, objectFit: 'cover', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
              </div>
              <div className="text-lg font-bold text-center" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
              <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                {c.regions.length} cities · {VENUES.filter(v => c.regions.includes(v.region)).length} venues · {VENUES.filter(v => c.regions.includes(v.region)).reduce((s, v) => s + v.courts.length, 0)} courts
              </div>
            </button>
          ))}
            <div className="rounded-xl p-5 flex flex-col items-center gap-3 opacity-80"
              style={{ background: 'var(--bg-surface)', border: '1px dashed var(--brand-accent)', minHeight: 180, height: 180, position: 'relative', cursor: 'default' }}>
              <div style={{ fontSize: 36 }}>🌍</div>
              <div className="text-lg font-bold text-center" style={{ color: 'var(--text-muted)' }}>New country</div>
              <div className="text-xs text-center px-2 py-1 rounded-full font-semibold" style={{ background: 'var(--brand-accent-muted)', color: 'var(--brand-accent)' }}>Coming soon</div>
              
            </div>  
        </div>
      )}
      {step === 'region' && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          {countryFilteredRegions.map(r => {
            const venues = VENUES.filter(v => v.region === r)
            const totalCourts = venues.reduce((s, v) => s + v.courts.length, 0)
            const hasLive = venues.some(v => v.isLive)
            return (
              <button key={r}
                onClick={() => { setRegion(r); setVenue(null); setDate(null); setCourt(null); setDuration(null); setTime(null); setStep('venue'); playSelectionSound() }}
                className="rounded-xl p-5 text-left transition-all flex flex-col justify-between"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', minHeight: 160 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-primary)', marginBottom: 12 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <div className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{r}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{venues.length}</span> venue{venues.length > 1 ? 's' : ''} · <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{totalCourts}</span> courts
                  </div>
                </div>
                <div className="flex gap-1 mt-3 flex-wrap">
                  {venues.slice(0,2).map(v => (
                    <span key={v.slug} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)', border: '1px solid #4DFFEE30' }}>
                      {v.name.split(' ').slice(-2).join(' ')}
                    </span>
                  ))}
                  {venues.length > 2 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)', border: '1px solid var(--brand-primary-muted)' }}>
                      +{venues.length - 2} more
                    </span>
                  )}
                </div>
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
              onClick={() => { setVenue(v); setDate(null); setCourt(null); setDuration(null); setTime(null); setStep('date'); playSelectionSound() }}
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
                  onClick={() => { setDate(d); setCourt(null); setDuration(null); setTime(null); setStep('court'); playSelectionSound() }}
                  className="rounded-xl p-3 text-center transition-all"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
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
          {courts.filter(c => (c as any).venue_slug === venue?.slug).sort((a, b) => parseInt(a.name.replace(/\D/g, '')) - parseInt(b.name.replace(/\D/g, ''))).map(c => (
            <button key={c.id}
              onClick={() => { setCourt(c); setDuration(null); setTime(null); setStep('duration'); playSelectionSound() }}
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
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          {DURATIONS.map(d => (
            <button key={d.value}
              onClick={() => { setDuration(d.value); setTime(null); setStep('time'); playSelectionSound() }}
              className="rounded-xl p-5 text-center transition-all"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{d.label}</div>
              {court && (
                <div className="text-xs" style={{ color: 'var(--brand-primary)' }}>
                  from {formatNzd(court.price_per_hour * (1 - discount) * d.value)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* STEP: Time */}
      {step === 'time' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-accent)' }} />
              <span style={{ color: 'var(--text-subtle)' }}>Peak (eve + weekends)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-primary)' }} />
              <span style={{ color: 'var(--text-subtle)' }}>Off-peak</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TIME_SLOTS.map(t => {
              const available = isSlotAvailable(t)
              const peak = isPeakTime(date, t)
              return (
                <button key={t} disabled={!available}
                  onClick={() => { setTime(t); setStep('confirm'); playSelectionSound() }}
                  className="rounded-xl p-3 text-center transition-all"
                  style={{
                    background: !available ? 'var(--bg-raised)' : 'var(--bg-surface)',
                    border: available ? '1px solid var(--border)' : '1px solid transparent',
                    color: !available ? 'var(--text-subtle)' : 'var(--text-primary)',
                    cursor: !available ? 'not-allowed' : 'pointer',
                    opacity: !available ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (available) e.currentTarget.style.borderColor = 'var(--brand-primary)' }}
                  onMouseLeave={e => { if (available) e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div className="text-sm font-semibold">{t}</div>
                  {available && (
                    <div className="text-[10px] mt-0.5 font-medium"
                      style={{ color: peak ? 'var(--brand-accent)' : 'var(--brand-primary)' }}>
                      {peak ? '⚡ Peak' : '✓ Off-peak'}
                    </div>
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
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            {[
              ['Venue', venue?.name],
              ['Court', court?.name + ' — ' + court?.type],
              ['Date', date ? formatDate(date) : ''],
              ['Time', time && duration ? time + ' — ' + addHoursDecimal(time, duration) : ''],
              ['Duration', duration ? durationLabel(duration) : ''],
              ['Pricing', isPeak ? '⚡ Peak rate' : '✓ Off-peak rate'],
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

          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Split the cost?</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Invite players to share the court fee</div>
              </div>
              <button onClick={() => setSplitEnabled(!splitEnabled)} style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, background: splitEnabled ? 'var(--brand-primary)' : 'var(--bg-raised)', border: '1px solid var(--border)', position: 'relative', transition: 'background 0.15s' }}>
                <div style={{ position: 'absolute', top: 2, left: splitEnabled ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: splitEnabled ? 'var(--brand-primary-on)' : 'var(--text-subtle)', transition: 'left 0.15s' }} />
              </button>
            </div>
            {splitEnabled && (
              <div className="mt-3 space-y-2">
                <div className="text-xs mb-1" style={{ color: 'var(--text-subtle)' }}>Select up to 3 players to split with</div>
                {allPlayers.filter(p => p.id !== userId).map(p => {
                  const selected = splitPlayers.includes(p.id)
                  return (
                    <button key={p.id} onClick={() => setSplitPlayers(prev => selected ? prev.filter(id => id !== p.id) : prev.length < 3 ? [...prev, p.id] : prev)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
                      style={{ background: selected ? 'var(--brand-primary-muted)' : 'var(--bg-raised)', border: selected ? '1px solid var(--brand-primary)' : '1px solid var(--border)' }}>
                      <span className="text-sm" style={{ color: selected ? 'var(--brand-primary)' : 'var(--text-primary)' }}>{p.nickname ?? p.full_name}</span>
                      {selected && <span className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }}>{formatNzd(courtPrice / (splitPlayers.length + 1))} each</span>}
                    </button>
                  )
                })}
                {splitPlayers.length > 0 && (
                  <div className="text-xs pt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                    You pay {formatNzd(courtPrice / (splitPlayers.length + 1))} - others notified to pay their share
                  </div>
                )}
              </div>
            )}
          </div>
          <button className="w-full py-4 rounded-xl text-base font-semibold transition-all"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
            disabled={submitting} onClick={handleConfirm}>
            {submitting ? 'Confirming…' : `Pay ${formatNzd(splitEnabled && splitPlayers.length > 0 ? courtPrice / (splitPlayers.length + 1) : courtPrice)} →`}
          </button>
        </div>
      )}

    </div>
  )
}















































