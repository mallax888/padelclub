'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { copyText } from '@/lib/copy-text'

// Share a tournament: a WhatsApp message, the link to the live leaderboard, or the picture to post.
export default function ShareMenu({ tournamentId, name, club }: { tournamentId: string; name: string; club: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])
  const url = () => `${window.location.origin}/t/${tournamentId}`
  const item = 'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left text-sm font-bold'
  const icon = (bg: string, ch: string) => <span aria-hidden className="inline-flex items-center justify-center rounded-lg text-xs font-black shrink-0" style={{ width: 28, height: 28, background: bg, color: '#fff' }}>{ch}</span>
  return (
    <div className="relative shrink-0" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} data-testid="share-open"
        className="rounded-full px-4 text-[13px] font-extrabold inline-flex items-center gap-1" style={{ minHeight: 38, background: 'var(--brand-primary)', color: 'var(--brand-primary-on)' }}>Share ▾</button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 z-30 rounded-2xl p-1.5" data-testid="share-menu" style={{ width: 250, background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
          <a role="menuitem" className={item} style={{ color: 'var(--text-primary)' }} data-testid="share-whatsapp" target="_blank" rel="noopener noreferrer"
            href={typeof window === 'undefined' ? '#' : `https://wa.me/?text=${encodeURIComponent(`${name} at ${club}: ${url()}`)}`} onClick={() => setOpen(false)}>
            {icon('#25D366', 'W')}Send on WhatsApp
          </a>
          <button role="menuitem" type="button" className={item} style={{ color: 'var(--text-primary)' }} data-testid="share-copy"
            onClick={async () => { const link = url(); if (await copyText(link)) toast.success('Leaderboard link copied'); else window.prompt('Copy this link:', link); setOpen(false) }}>
            {icon('var(--bg-raised)', '⧉')}Copy leaderboard link
          </button>
          <a role="menuitem" className={item} style={{ color: 'var(--text-primary)' }} data-testid="share-picture" href={`/t/${tournamentId}/card?download=1`} download onClick={() => setOpen(false)}>
            {icon('var(--bg-raised)', '▣')}Save the picture
          </a>
          <p className="text-[11px] px-3 pt-1 pb-2" style={{ color: 'var(--text-subtle)' }}>Anyone with the link can see names and scores, nothing else.</p>
        </div>
      )}
    </div>
  )
}
