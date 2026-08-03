'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export default function NavMoreMenu({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const isActive = items.some(item => pathname.startsWith(item.href))

  if (items.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('nav-tab flex items-center gap-1', (open || isActive) && 'nav-tab-active')}
      >
        More
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-44 rounded-xl p-1.5 z-50"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {items.map(item => (
            <Link key={item.href} href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm"
              style={{
                background: pathname.startsWith(item.href) ? 'var(--bg-raised)' : 'transparent',
                color: pathname.startsWith(item.href) ? 'var(--brand-primary)' : 'var(--text-primary)',
                fontWeight: pathname.startsWith(item.href) ? 500 : 400,
              }}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
