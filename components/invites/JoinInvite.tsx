'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/currency'
import { forgetInvite, rememberInvite } from '@/lib/return-to'
import type { InvitePreview } from '@/lib/invites'

export type JoinState = 'open' | 'claimed' | 'expired' | 'cancelled' | 'invalid' | 'unavailable'

const display = { fontFamily: 'var(--font-display), Manrope, sans-serif' } as const

export default function JoinInvite({ token, state, preview, signedIn, isOwnBooking, alreadyJoined }: {
  token: string
  state: JoinState
  preview: InvitePreview | null
  signedIn: boolean
  isOwnBooking: boolean
  alreadyJoined: boolean
}) {
  const router = useRouter()
  const [joining, setJoining] = useState(false)

  // Someone who isn't signed in has to leave this page to make an account, and
  // the confirmation email brings them back to a page that has never heard of
  // this link. Remembering it in a cookie is what lets sign-up, email
  // confirmation and onboarding all end up back here. Anywhere that isn't an
  // open invite waiting on a sign-in, it is forgotten, so a stale link can't
  // pull someone off to a dead page every time they log in.
  useEffect(() => {
    if (state === 'open' && !signedIn && !isOwnBooking) rememberInvite(token)
    else forgetInvite()
  }, [state, signedIn, isOwnBooking, token])

  const next = encodeURIComponent(`/join/${token}`)

  const join = async () => {
    setJoining(true)
    try {
      const res = await fetch('/api/invites/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error ?? 'Could not join the game.')
        setJoining(false)
        // The invite may have just been taken, cancelled or started: show the
        // page for what it is now rather than leave a button that can't work.
        router.refresh()
        return
      }
      forgetInvite()
      toast.success("You're in! Pay your share to lock in your spot.")
      router.push('/mybookings')
      router.refresh()
    } catch {
      toast.error('Could not join the game. Check your connection and try again.')
      setJoining(false)
    }
  }

  const organiser = preview?.organiserName ?? 'Your friend'

  // Everything that isn't "here is a spot you can take" is a short message with
  // one way out.
  const message = (() => {
    if (state === 'invalid') {
      return { emoji: '🔗', title: "This invite link isn't valid", text: "Check you've copied the whole link, or ask your friend to send it again." }
    }
    if (state === 'unavailable') {
      return { emoji: '⏳', title: "Invites aren't ready yet", text: 'Please try this link again shortly.' }
    }
    if (state === 'cancelled') {
      return { emoji: '🚫', title: 'This booking was cancelled', text: `${organiser} cancelled this court, so there's nothing to join.` }
    }
    if (state === 'expired') {
      return { emoji: '⏱️', title: 'This game has already started', text: `Ask ${organiser} about the next one.` }
    }
    if (state === 'claimed') {
      return alreadyJoined
        ? { emoji: '✅', title: "You're in this game", text: `${organiser} has your spot at ${preview?.courtName}, ${preview?.venueName} on ${preview?.dateLabel}.` }
        : { emoji: '🙈', title: 'This spot has been taken', text: `Someone else got there first. Ask ${organiser} to send you another link.` }
    }
    if (isOwnBooking) {
      return { emoji: '👋', title: 'This is your own invite', text: 'Send this link to a friend and they can take the spot. Open it on their phone, not yours.' }
    }
    return null
  })()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(circle at 50% 0%, var(--brand-primary-muted), var(--bg-base) 60%)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <span className="inline-flex items-center justify-center rounded-full text-xl"
            style={{ width: 40, height: 40, background: 'var(--brand-primary)', boxShadow: 'var(--glow-primary)' }}>🎾</span>
          <span className="text-xl font-extrabold tracking-tight" style={{ ...display, color: 'var(--text-primary)' }}>PadelClub</span>
        </div>

        <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          {message ? (
            <div className="text-center py-3">
              <div className="text-4xl mb-3">{message.emoji}</div>
              <div className="text-xl font-extrabold mb-1.5" style={{ ...display, color: 'var(--text-primary)' }}>{message.title}</div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{message.text}</p>
              <Link href={signedIn ? '/mybookings' : '/'}
                className="mt-5 flex items-center justify-center rounded-xl py-3 text-sm font-bold"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                {signedIn ? 'My bookings' : 'Go to PadelClub'}
              </Link>
            </div>
          ) : preview && (
            <>
              <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.14em', color: 'var(--brand-primary-text)' }}>You&apos;re invited</div>
              <div className="text-[26px] leading-tight font-extrabold mt-1.5" style={{ ...display, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {organiser} saved you a spot
              </div>

              <div className="rounded-xl mt-4 px-4 py-3 space-y-2" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                {[
                  ['Where', `${preview.venueName}${preview.region ? `, ${preview.region}` : ''}`],
                  ['Court', preview.courtName],
                  ['When', `${preview.dateLabel} · ${preview.timeLabel}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 text-sm">
                    <span style={{ color: 'var(--text-subtle)' }}>{label}</span>
                    <span className="text-right font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-end justify-between mt-4">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Your share</span>
                <span className="text-[34px] leading-none font-extrabold" style={{ ...display, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                  {formatPrice(preview.share, preview.currency)}
                </span>
              </div>

              {signedIn ? (
                <button type="button" onClick={join} disabled={joining}
                  className="mt-5 w-full rounded-xl py-3.5 text-base font-extrabold disabled:opacity-60"
                  style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
                  {joining ? 'Joining…' : 'Join this game'}
                </button>
              ) : (
                <div className="mt-5 space-y-2">
                  <Link href={`/auth/signup?next=${next}`}
                    className="flex items-center justify-center w-full rounded-xl py-3.5 text-base font-extrabold"
                    style={{ background: 'var(--brand-primary)', color: 'var(--brand-primary-on)', boxShadow: 'var(--glow-primary)' }}>
                    Create an account to join
                  </Link>
                  <Link href={`/auth/login?next=${next}`}
                    className="flex items-center justify-center w-full rounded-xl py-3 text-sm font-bold"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    I already have an account
                  </Link>
                </div>
              )}
              <p className="text-xs text-center mt-3" style={{ color: 'var(--text-subtle)' }}>
                {signedIn
                  ? 'Nothing is charged until you tap Pay on the next screen.'
                  : 'Takes about a minute. Nothing is charged until you pay your share.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
