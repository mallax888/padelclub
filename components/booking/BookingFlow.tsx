'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatDate, generateTimeSlots, addHours, localDateStr } from '@/lib/utils'
import { currencyForRegion, formatPrice } from '@/lib/currency'
import { isPeakTime, computeCourtPrice } from '@/lib/pricing'
import { MEMBERSHIP_CONFIG } from '@/types/database'
import type { Court, Profile } from '@/types/database'
import { VENUES, COUNTRIES, type Venue } from '@/lib/venues'
import { playSelectionSound, playBackSound } from '@/lib/sounds'

const TIME_SLOTS = generateTimeSlots(7, 22, 30)
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const REGIONS = VENUES.map(v => v.region).filter((r, i, arr) => arr.indexOf(r) === i)

const DURATIONS = [
  { value: 0.5, label: '30 min'  },
  { value: 1,   label: '60 min'  },
  { value: 1.5, label: '90 min'  },
  { value: 2,   label: '120 min' },
]

function durationLabel(d: number) {
  if (d === 0.5) return '30 min'
  if (d === 1)   return '60 min'
  if (d === 1.5) return '90 min'
  return '120 min'
}

// Country, region and venue are only walked when we don't already know where
// this member plays. Onboarding asks for a home venue and stores it, so most
// bookings start at 'when'; "Change" on the when screen is what sends someone
// back to the top to pick somewhere else.
//
// Date, duration and time used to be three separate screens, with a fourth
// asking which court. They are one question -- when do you want to play, and
// for how long -- and the court is only a real question at the 5 venues of 36
// whose courts aren't all the same type. Everywhere else it asked someone to
// choose between four identical things. 'when' now carries all of it, and the
// court is assigned from whatever is actually free.
type Step = 'country' | 'region' | 'venue' | 'when' | 'confirm'
const STEPS: Step[] = ['country', 'region', 'venue', 'when', 'confirm']

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return { day: DAYS[d.getDay()], num: d.getDate(), month: MONTHS[d.getMonth()] }
}

export default function BookingFlow({
    courts,
    profile,
    userId,
    allPlayers = [],
  }: {
    courts: Court[]
    profile: Profile
    userId: string
    allPlayers?: { id: string; full_name: string | null; nickname: string | null }[]
  }) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const tier = profile?.membership_tier ?? 'casual'
  const memConfig = MEMBERSHIP_CONFIG[tier] ?? MEMBERSHIP_CONFIG['casual']
  const discount = memConfig.discount
  const dates = Array.from({ length: memConfig.bookingWindowDays }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return localDateStr(d)
  })

  // Onboarding asked where they play and saved it. Walking them through
  // country -> region -> venue again on every booking, to arrive at the club
  // they already named, was three taps of pure ceremony.
  const homeVenue = VENUES.find(v => v.slug === (profile as any)?.home_venue_slug) ?? null
  const homeCountry = homeVenue
    ? COUNTRIES.find(c => c.regions.includes(homeVenue.region))?.name ?? null
    : null

  const [step, setStep] = useState<Step>(homeVenue ? 'when' : 'country')
  const [country, setCountry] = useState<string | null>(homeCountry)
  const [region, setRegion] = useState<string | null>(homeVenue?.region ?? null)
  const [venue, setVenue] = useState<Venue | null>(homeVenue)
  const currency = currencyForRegion(venue?.region)
  const [date, setDate] = useState<string | null>(null)
  // Most people book an hour. Defaulting it means the time grid has something
  // to show the moment a date is picked, instead of an empty screen waiting
  // on a question most members answer the same way every time.
  const [duration, setDuration] = useState<number | null>(1)
  const [courtTypeFilter, setCourtTypeFilter] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [busyByCourt, setBusyByCourt] = useState<Record<string, Set<number>>>({})
  const [makePublic, setMakePublic] = useState(false)
  const [matchType, setMatchType] = useState<'casual' | 'competitive'>('casual')
  const [matchNotes, setMatchNotes] = useState('')
  const [skillFilter, setSkillFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitPlayers, setSplitPlayers] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [dateBusyness, setDateBusyness] = useState<Record<string, number>>({})

  // "Busy at a glance" on the date picker: how much of the venue's total
  // court-time is already booked on each visible day, so people can see a
  // quiet day without clicking into each one individually.
  useEffect(() => {
    if (!venue) { setDateBusyness({}); return }
    const venueCourts = courts.filter(c => (c as any).venue_slug === venue.slug)
    if (venueCourts.length === 0) { setDateBusyness({}); return }
    const courtIds = venueCourts.map(c => c.id)
    const OPEN_MINUTES_PER_DAY = (22 - 7) * 60

    supabase
      .from('bookings')
      .select('date, duration_minutes')
      .in('court_id', courtIds)
      .in('date', dates)
      .in('status', ['confirmed', 'blocked'])
      .then(({ data }: any) => {
        const bookedMinutes: Record<string, number> = {}
        ;(data ?? []).forEach((b: any) => {
          bookedMinutes[b.date] = (bookedMinutes[b.date] ?? 0) + (b.duration_minutes ?? 60)
        })
        const capacity = venueCourts.length * OPEN_MINUTES_PER_DAY
        const busyness: Record<string, number> = {}
        dates.forEach(d => { busyness[d] = Math.min((bookedMinutes[d] ?? 0) / capacity, 1) })
        setDateBusyness(busyness)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue?.slug])

  const busynessLabel = (ratio: number | undefined) => {
    if (ratio === undefined) return null
    if (ratio < 0.2) return { text: 'Quiet', color: 'var(--brand-primary-text)' }
    if (ratio < 0.5) return { text: 'Moderate', color: 'var(--brand-yellow)' }
    return { text: 'Busy', color: 'var(--brand-crimson)' }
  }

  const [isRebooking, setIsRebooking] = useState(false)

  // "Book again" from My Bookings links here with the same court + duration
  // as a past booking, skipping straight to picking a new date instead of
  // re-walking country -> region -> venue -> court -> duration.
  useEffect(() => {
    const courtId = searchParams.get('courtId')
    if (!courtId) return
    const rebookCourt = courts.find(c => c.id === courtId)
    const rebookVenue = rebookCourt ? VENUES.find(v => v.slug === (rebookCourt as any).venue_slug) : undefined
    if (!rebookCourt || !rebookVenue) return
    const rebookCountry = COUNTRIES.find(c => c.regions.includes(rebookVenue.region))?.name ?? null

    setCountry(rebookCountry)
    setRegion(rebookVenue.region)
    setVenue(rebookVenue)
    // Keep the court's type rather than the court itself: the same slot on an
    // identical court is the same booking, and pinning court 3 would offer
    // fewer times than the venue actually has free.
    setCourtTypeFilter(rebookCourt.type ?? null)
    const durationParam = Number(searchParams.get('duration'))
    if (durationParam > 0) setDuration(durationParam / 60)
    setIsRebooking(true)
    setStep('when')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Availability across every court at the venue, not just one. The flow no
  // longer asks which court, so a time is offered when *any* court can take
  // it, and the court itself is chosen from what's free.
  useEffect(() => {
    if (!venue || !date) { setBusyByCourt({}); return }
    const ids = courts.filter(c => (c as any).venue_slug === venue.slug).map(c => c.id)
    if (ids.length === 0) { setBusyByCourt({}); return }
    supabase.from('bookings')
      .select('court_id, start_time, duration_minutes')
      .in('court_id', ids)
      .eq('date', date)
      .in('status', ['confirmed', 'blocked'])
      .then(({ data }: any) => {
        const busy: Record<string, Set<number>> = {}
        for (const id of ids) busy[id] = new Set<number>()
        ;(data ?? []).forEach((b: any) => {
          const start = parseInt(b.start_time.slice(0, 2)) * 60 + parseInt(b.start_time.slice(3, 5))
          for (let m = 0; m < (b.duration_minutes ?? 60); m += 30) {
            busy[b.court_id]?.add(start + m)
          }
        })
        setBusyByCourt(busy)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue?.slug, date])

  // Courts at this venue, narrowed to the chosen type where the venue has
  // more than one (Wellington's singles/doubles, Camps Bay's indoor/outdoor).
  const venueCourts = venue ? courts.filter(c => (c as any).venue_slug === venue.slug) : []
  const courtTypes = Array.from(new Set(venueCourts.map(c => c.type))).sort()
  const selectableCourts = courtTypeFilter
    ? venueCourts.filter(c => c.type === courtTypeFilter)
    : venueCourts

  // Every court that could take a booking of this length starting at `t`.
  // Ordered as the venue lists them, so the lowest-numbered free court wins
  // and bookings cluster rather than scattering across the venue.
  const freeCourtsAt = (t: string, forDuration: number | null = duration): Court[] => {
    if (!forDuration) return []
    const [h, m] = t.split(':').map(Number)
    const start = h * 60 + m
    if ((start + forDuration * 60) > 22 * 60) return []
    return selectableCourts.filter(c => {
      const busy = busyByCourt[c.id]
      if (!busy) return true
      for (let offset = 0; offset < forDuration * 60; offset += 30) {
        if (busy.has(start + offset)) return false
      }
      return true
    })
  }

  const isSlotAvailable = (t: string) => freeCourtsAt(t).length > 0

  // What the confirm screen names, and what the insert attempts first.
  const assignedCourt = time ? (freeCourtsAt(time)[0] ?? null) : null

  const isPeak = isPeakTime(date, time)
  const courtPrice = assignedCourt && date && time && duration ? computeCourtPrice(assignedCourt, date, time, duration, discount) : 0

  const goBack = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  // Android/PWA hardware back button support: register each forward step
  // with browser history so the native back gesture steps back one at a
  // time instead of exiting the wizard entirely.
  const stepIndexRef = useRef(0)
  useEffect(() => {
    const idx = STEPS.indexOf(step)
    if (idx > stepIndexRef.current) {
      window.history.pushState({ padelStep: idx }, '')
    }
    stepIndexRef.current = idx
  }, [step])

  useEffect(() => {
    const onPopState = () => {
      setStep(prev => {
        const idx = STEPS.indexOf(prev)
        return idx > 0 ? STEPS[idx - 1] : prev
      })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const addHoursDecimal = (timeStr: string, hrs: number) => {
    const [h, m] = timeStr.split(':').map(Number)
    const totalMins = h * 60 + m + hrs * 60
    return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`
  }

  const handleConfirm = async () => {
    if (!time || !date || !userId || !duration) return
    setSubmitting(true)
    const sb = supabase
    const endTime = addHoursDecimal(time, duration)

    // Try every court that looked free, not just the one named on the confirm
    // screen. Nobody picked that court -- it was assigned -- so if someone
    // else took it while this screen was open, the next identical court is a
    // better answer than an error telling the member to start again.
    const candidates = freeCourtsAt(time)
    let bookingData: any = null
    let error: any = null
    for (const candidate of candidates) {
      const attempt = await sb.from('bookings').insert({
        user_id: userId,
        court_id: candidate.id,
        date,
        start_time: time + ':00',
        end_time: endTime + ':00',
        duration_minutes: duration * 60,
        status: 'confirmed',
        price_nzd: parseFloat(computeCourtPrice(candidate, date, time, duration, discount).toFixed(2)),
        discount_applied: discount,
        payment_method: 'card',
      }).select().single()
      if (!attempt.error) { bookingData = attempt.data; break }
      error = attempt.error
      // Anything but "that slot just went" is a real failure -- don't retry
      // the same problem against every court in the venue.
      if (attempt.error.code !== '23505' && attempt.error.code !== '23P01') break
    }

    const court = bookingData ? candidates.find(c => c.id === bookingData.court_id) ?? null : null

    if (!bookingData) {
      toast.error(
        !error ? 'That time has just gone — pick another.'
        : error.code === '23505' || error.code === '23P01'
          ? 'Every court at that time has just gone — pick another.'
        : error.message
      )
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
        court_id: bookingData.court_id,
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
        const { error: splitError } = await sb.from('booking_splits').insert({
          booking_id: bookingData.id,
          invited_by: userId,
          user_id: pid,
          amount_nzd: splitAmount,
          status: 'pending',
        })
        if (splitError) {
          console.error('Failed to create booking split for', pid, splitError)
          continue
        }
        const { error: notifyError } = await sb.from('notifications').insert({
          user_id: pid,
          type: 'split_request',
          message: (profile?.full_name ?? 'Someone') + ' is requesting ' + formatPrice(splitAmount, currency) + ' for a court booking.',
        })
        if (notifyError) {
          console.error('Failed to notify', pid, 'of split request', notifyError)
        }
      }
    }

    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: bookingData.id,
        courtName: court ? `${court.name} — ${court.type}` : 'Court',
        date: formatDate(date),
        time: time + ' — ' + endTime,
        // create-checkout derives the actual split count itself from the
        // booking_splits rows just inserted above -- it doesn't trust a
        // client-supplied number (previously it did, keyed off `makePublic`
        // of all things, which had nothing to do with bill-splitting and
        // let anyone get charged a quarter price with no one ever billed
        // the rest).
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



  // A member who never saw the venue picker is on a two-step flow, so the
  // progress bar and the back arrow should both reflect that rather than the
  // full five-step path somebody choosing a new venue walks.
  const skippedVenuePicker = step === 'when' || step === 'confirm'
  const visibleSteps: Step[] = skippedVenuePicker && venue === homeVenue && homeVenue !== null
    ? ['when', 'confirm']
    : STEPS

  const stepMeta: Record<Step, { title: string; subtitle?: string }> = {
    country:  { title: 'Where are you based?' },
    region:   { title: 'Choose a city', subtitle: country ?? '' },
    venue:    { title: 'Choose a venue', subtitle: region ?? '' },
    when:     { title: 'When do you want to play?' },
    confirm:  { title: 'Confirm booking', subtitle: date ? formatDate(date) : '' },
  }

  return (
    <div className="max-w-lg mx-auto">

      {/* Back arrow + step title */}
      <div className="flex items-center gap-3 mb-6">
        {step !== visibleSteps[0] && (
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

      {/* Progress bar — only the steps this booking will actually take.
          Someone whose venue is already known walks two screens, and showing
          five segments mostly filled in told them they were further through a
          longer journey than the one they are on. */}
      <div className="flex gap-1.5 mb-6">
        {visibleSteps.map(s => (
          <div key={s} className="h-1 flex-1 rounded-full transition-all"
            style={{ background: visibleSteps.indexOf(s) <= visibleSteps.indexOf(step) ? 'var(--brand-primary)' : 'rgba(128,128,128,0.35)' }} />
        ))}
      </div>

      {/* STEP: Country */}
      {step === 'country' && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          {COUNTRIES.map(c => (
            <button key={c.name}
              onClick={() => { setCountry(c.name); setRegion(null); setVenue(null); setDate(null); setDuration(null); setTime(null); setStep('region'); playSelectionSound() }}
              className="rounded-xl p-5 transition-all flex flex-col items-center gap-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', minHeight: 180, position: 'relative' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <img src={c.flag} alt={c.name} style={{ width: 80, height: 53, objectFit: 'cover', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
              </div>
              <div className="text-lg font-bold text-center" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
              <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                {c.regions.length} cities · {VENUES.filter(v => c.regions.includes(v.region)).length} venues · {courts.filter(ct => VENUES.some(v => c.regions.includes(v.region) && v.slug === (ct as any).venue_slug)).length} courts
              </div>
            </button>
          ))}
            <div className="rounded-xl p-5 flex flex-col items-center gap-3 opacity-80"
              style={{ background: 'var(--bg-surface)', border: '1px dashed var(--brand-accent)', minHeight: 180, position: 'relative', cursor: 'default' }}>
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
            const totalCourts = courts.filter(ct => venues.some(v => v.slug === (ct as any).venue_slug)).length
            return (
              <button key={r}
                onClick={() => { setRegion(r); setVenue(null); setDate(null); setDuration(null); setTime(null); setStep('venue'); playSelectionSound() }}
                className="rounded-xl p-5 text-left transition-all flex flex-col justify-between"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', minHeight: 160 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-primary-text)', marginBottom: 12 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <div className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--brand-primary-text)', fontWeight: 600 }}>{venues.length}</span> venue{venues.length > 1 ? 's' : ''} · <span style={{ color: 'var(--brand-primary-text)', fontWeight: 600 }}>{totalCourts}</span> courts
                  </div>
                </div>
                <div className="flex gap-1 mt-3 flex-wrap">
                  {venues.slice(0,2).map(v => (
                    <span key={v.slug} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', border: '1px solid var(--brand-primary-muted)' }}>
                      {v.name.split(' ').slice(-2).join(' ')}
                    </span>
                  ))}
                  {venues.length > 2 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)', border: '1px solid var(--brand-primary-muted)' }}>
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
          {regionVenues.map(v => {
            const realCourtCount = courts.filter(c => (c as any).venue_slug === v.slug).length
            return (
            <button key={v.slug}
              onClick={() => {
                if (realCourtCount === 0) {
                  toast.error(`${v.name} doesn't have any courts set up yet.`)
                  return
                }
                setVenue(v); setDate(null); setCourtTypeFilter(null); setTime(null); setStep('when'); playSelectionSound()
              }}
              className="w-full rounded-xl px-4 py-4 text-left transition-all flex items-center justify-between"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', opacity: realCourtCount === 0 ? 0.6 : 1 }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{v.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {v.address.split(',').slice(0,2).join(',')}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {realCourtCount > 0 ? `${realCourtCount} courts` : 'Courts coming soon'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {realCourtCount === 0 && (
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
            )
          })}
        </div>
      )}

      {/* STEP: When — date, length and time on one screen */}
      {step === 'when' && (
        <div className="animate-fade-in">

          {/* The venue, as a fact you can change rather than a question you
              answer every time. */}
          <button
            onClick={() => { setDate(null); setTime(null); setStep('country'); playBackSound() }}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-5 text-left"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--brand-primary)', flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span className="min-w-0">
              <span className="block text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{venue?.name}</span>
              <span className="block text-[11px]" style={{ color: 'var(--text-subtle)' }}>{venue?.region}</span>
            </span>
            <span className="ml-auto text-xs font-bold shrink-0" style={{ color: 'var(--brand-primary-text)' }}>Change</span>
          </button>

          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-subtle)' }}>Date</div>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {dates.map(d => {
              const { day, num, month } = dateLabel(d)
              const busy = busynessLabel(dateBusyness[d])
              const on = date === d
              return (
                <button key={d}
                  onClick={() => { setDate(d); setTime(null); playSelectionSound() }}
                  className="rounded-xl p-3 text-center transition-all"
                  style={{
                    background: on ? 'var(--brand-primary)' : 'var(--bg-surface)',
                    border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border)'}`,
                  }}>
                  <div className="text-[10px]" style={{ color: on ? 'var(--brand-primary-on)' : 'var(--text-muted)' }}>{day}</div>
                  <div className="text-lg font-bold" style={{ color: on ? 'var(--brand-primary-on)' : 'var(--text-primary)' }}>{num}</div>
                  <div className="text-[10px]" style={{ color: on ? 'var(--brand-primary-on)' : 'var(--text-muted)', opacity: on ? 0.7 : 1 }}>{month}</div>
                  {busy && (
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      {!on && <span style={{ width: 5, height: 5, borderRadius: '50%', background: busy.color }} />}
                      <span className="text-[9px] font-semibold" style={{ color: on ? 'var(--brand-primary-on)' : busy.color, opacity: on ? 0.7 : 1 }}>{busy.text}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-subtle)' }}>How long</div>
          <div className="flex gap-1.5 rounded-xl p-1 mb-5" style={{ background: 'var(--bg-raised)' }}>
            {DURATIONS.map(d => (
              <button key={d.value}
                onClick={() => { setDuration(d.value); setTime(null); playSelectionSound() }}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: duration === d.value ? 'var(--brand-primary)' : 'transparent',
                  color: duration === d.value ? 'var(--brand-primary-on)' : 'var(--text-muted)',
                }}>
                {d.label}
              </button>
            ))}
          </div>

          {/* Only shown where the courts actually differ. At the 31 venues
              whose courts are all one type this would be a choice between
              identical things. */}
          {courtTypes.length > 1 && (
            <>
              <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-subtle)' }}>Court type</div>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {[null, ...courtTypes].map(t => (
                  <button key={t ?? 'any'}
                    onClick={() => { setCourtTypeFilter(t); setTime(null); playSelectionSound() }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: courtTypeFilter === t ? 'var(--brand-primary-muted)' : 'var(--bg-surface)',
                      border: `1px solid ${courtTypeFilter === t ? 'var(--brand-primary)' : 'var(--border)'}`,
                      color: courtTypeFilter === t ? 'var(--brand-primary-text)' : 'var(--text-muted)',
                    }}>
                    {t ?? 'Any court'}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-subtle)' }}>
            {date ? 'Available times' : 'Pick a date to see times'}
          </div>
          {date && (
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
                        style={{ color: peak ? 'var(--brand-accent)' : 'var(--brand-primary-text)' }}>
                        {peak ? '⚡ Peak' : '✓ Off-peak'}
                      </div>
                    )}
                    {!available && <div className="text-[10px] mt-0.5">Taken</div>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP: Confirm */}
      {step === 'confirm' && (
        <div className="animate-fade-in">
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
            {[
              ['Venue', venue?.name],
              ['Court', assignedCourt ? `${assignedCourt.name} — ${assignedCourt.type}` : '—'],
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
              <span className="text-xl" style={{ color: 'var(--brand-primary-text)', fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 700 }}>{formatPrice(courtPrice, currency)}</span>
            </div>
          </div>

          {/* Open match toggle */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
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

          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
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
                      style={{
                        background: selected ? 'var(--brand-primary-muted)' : 'var(--bg-raised)',
                        border: selected ? '1px solid var(--brand-primary)' : '1px solid var(--border)',
                        boxShadow: selected ? 'var(--glow-primary)' : 'none',
                      }}>
                      <span className="text-sm" style={{ color: selected ? 'var(--brand-primary-text)' : 'var(--text-primary)' }}>{p.nickname ?? p.full_name}</span>
                      {selected && <span className="text-xs font-semibold" style={{ color: 'var(--brand-primary-text)' }}>{formatPrice(Math.round(courtPrice / (splitPlayers.length + 1)), currency)} each</span>}
                    </button>
                  )
                })}
                {splitPlayers.length > 0 && (
                  <div className="text-xs pt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                    You pay {formatPrice(Math.round(courtPrice / (splitPlayers.length + 1)), currency)} - others notified to pay their share
                  </div>
                )}
              </div>
            )}
          </div>
          <button className="w-full py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}
            disabled={submitting} onClick={handleConfirm}>
            {submitting ? (
              <span className="text-lg font-extrabold">Confirming…</span>
            ) : (
              <>
                <span className="text-[30px] leading-none font-bold uppercase tracking-wide">Pay</span>
                <span className="text-[30px] leading-none" style={{ fontFamily: 'var(--font-display), Manrope, sans-serif', fontWeight: 700 }}>
                  {formatPrice(Math.round(splitEnabled && splitPlayers.length > 0 ? courtPrice / (splitPlayers.length + 1) : courtPrice), currency)}
                </span>
                <span className="text-xl font-bold">→</span>
              </>
            )}
          </button>
        </div>
      )}

    </div>
  )
}















































