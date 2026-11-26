'use client'

import { useState } from 'react'
import MessageSheet from '@/components/players/MessageSheet'
import { formatPrice, type CurrencyCode } from '@/lib/currency'

// Owners: players who used to play here and have gone quiet, with what they have booked so far, and a button that opens a
// ready-written "we have missed you" message to just them. It only shows when someone has gone quiet.
export default function QuietPlayersRow({ venueSlug, club, count, names, booked, currency }: { venueSlug: string; club: string; count: number; names: string[]; booked: number; currency: CurrencyCode }) {
  const [open, setOpen] = useState(false)
  const shown = names.slice(0, 3).join(', ')
  const who = count > names.slice(0, 3).length ? `${shown} and ${count - 3} more` : shown
  return (
    <>
      <div data-testid="quiet-row" className="flex items-center gap-3 p-4 rounded-[16px] mb-2" style={{ minHeight: 60, background: 'var(--bg-surface)', border: '1px solid color-mix(in srgb, var(--busy-amber) 45%, transparent)' }}>
        <span aria-hidden className="inline-flex items-center justify-center rounded-[11px] font-extrabold shrink-0" style={{ width: 34, height: 34, background: 'var(--amber-muted)', color: 'var(--busy-amber)' }}>↺</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{count} {count === 1 ? 'player hasn’t' : 'players haven’t'} played in 30 days</span>
          <span className="block text-[12.5px] mt-0.5 font-semibold" style={{ color: 'var(--text-muted)' }}>{who}{booked > 0 ? ` · ${formatPrice(booked, currency).replace(/\.00$/, '')} booked with you so far` : ''}</span>
        </span>
        <button type="button" onClick={() => setOpen(true)} data-testid="quiet-message" className="shrink-0 rounded-[11px] px-3.5 text-[12.5px] font-black" style={{ minHeight: 38, background: '#d4f53c', color: '#17240a' }}>Message them</button>
      </div>
      {open && <MessageSheet venueSlug={venueSlug} club={club} target={{ segment: 'quiet', count }} onClose={() => setOpen(false)} />}
    </>
  )
}
