'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { SEGMENTS, countSegments, filterPlayers, groupBooked, lastPlayedLabel, matchesQuery, sortFor, type ClubPlayer, type Segment } from '@/lib/club-players'
import MessageSheet, { type MessageTarget } from '@/components/players/MessageSheet'
import ReminderSheet from '@/components/players/ReminderSheet'
import { contactLabel, type Contact, type ContactSummary } from '@/lib/contact-rules'

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
const PAGE = 25

// The owner's list of the club's players: who they are, when they last played and what they have booked, with one tap to
// message a whole group. Front desk gets the same list without the money and without messaging.
export default function ClubPlayers({ players, today, venueSlug, club, currency, showMoney, canMessage, contacts = [], contactInfo = null, canImport = false, emailReady = false }: {
  players: ClubPlayer[]; today: string; venueSlug: string; club: string; currency: CurrencyCode; showMoney: boolean; canMessage: boolean
  contacts?: Contact[]; contactInfo?: ContactSummary | null; canImport?: boolean; emailReady?: boolean
}) {
  const [view, setView] = useState<Segment | 'contacts'>('all')
  const segment: Segment = view === 'contacts' ? 'all' : view
  const viewContacts = view === 'contacts'
  const [reminding, setReminding] = useState(false)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [target, setTarget] = useState<MessageTarget | null>(null)
  const counts = useMemo(() => countSegments(players, today), [players, today])
  const group = useMemo(() => filterPlayers(players, segment, today), [players, segment, today])
  const list = useMemo(() => sortFor(group.filter(p => matchesQuery(p, query)), segment), [group, segment, query])
  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)' } as const
  const quiet = segment === 'quiet'
  const pick = (s: Segment | 'contacts') => { setView(s); setShown(PAGE) }
  const liveContacts = useMemo(() => contacts.filter(c => !c.unsubscribedAt && !c.userId && c.status !== 'joined').filter(c => !query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()) || c.email.includes(query.trim().toLowerCase())), [contacts, query])

  return (
    <div className="w-full lg:flex-1 min-w-0" data-testid="club-players">
      <label className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-3" style={{ ...card }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-subtle)' }}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input value={query} onChange={e => { setQuery(e.target.value); setShown(PAGE) }} placeholder="Search players" aria-label="Search players" data-testid="player-search"
          className="w-full min-w-0 bg-transparent border-0 outline-none p-0 text-[14px]" style={{ color: 'var(--text-primary)' }} />
      </label>

      <div className="flex gap-2 mb-3 overflow-x-auto -mx-1 px-1 pb-1" role="tablist" aria-label="Groups of players">
        {SEGMENTS.filter(s => showMoney || s.key !== 'owes').map(s => {
          const on = view === s.key
          return (
            <button key={s.key} type="button" role="tab" aria-selected={on} data-testid={`seg-${s.key}`} onClick={() => pick(s.key)}
              className="shrink-0 rounded-full px-4 py-2.5 text-[13px] font-extrabold whitespace-nowrap"
              style={on ? { background: 'var(--brand-primary)', color: '#fff', border: '1px solid var(--brand-primary)' } : { ...card, color: 'var(--text-muted)' }}>
              <span className="lg:hidden">{s.short}</span><span className="hidden lg:inline">{s.label}</span>
              <b className="ml-1.5" style={{ color: on ? '#fff' : 'var(--text-primary)' }}>{counts[s.key]}</b>
            </button>
          )
        })}
        {contactInfo && contactInfo.notJoined > 0 && (
          <button type="button" role="tab" aria-selected={viewContacts} data-testid="seg-contacts" onClick={() => pick('contacts')}
            className="shrink-0 rounded-full px-4 py-2.5 text-[13px] font-extrabold whitespace-nowrap"
            style={viewContacts ? { background: 'var(--brand-primary)', color: '#fff', border: '1px solid var(--brand-primary)' } : { ...card, color: 'var(--text-muted)' }}>
            <span className="lg:hidden">Not joined</span><span className="hidden lg:inline">Imported, not joined yet</span>
            <b className="ml-1.5" style={{ color: viewContacts ? '#fff' : '#d4f53c' }}>{contactInfo.notJoined}</b>
          </button>
        )}
      </div>

      {canImport && (
        <div className="flex justify-end -mt-1 mb-3"><Link href={`/players/import?venue=${venueSlug}`} data-testid="import-link" className="rounded-full px-4 py-2 text-[12.5px] font-extrabold" style={{ ...card, color: 'var(--brand-primary-text)' }}>Import players</Link></div>
      )}

      {viewContacts && contactInfo ? (
        <div data-testid="contacts-panel">
          {contactInfo.toInvite > 0 ? (
            <div className="rounded-[18px] p-4 mb-3 flex items-center gap-4" data-testid="contacts-toinvite" style={{ background: 'rgba(212,245,60,0.09)', border: '1px solid rgba(212,245,60,0.45)' }}>
              <div className="min-w-0 flex-1"><div className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{contactInfo.toInvite} imported, not invited yet</div><div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>They are saved. Nothing is sent until you review the email and press send.</div></div>
              {canImport && <Link href={`/players/import?venue=${venueSlug}&step=invite`} data-testid="contacts-review" className="shrink-0 rounded-full px-5 py-2.5 text-[13px] font-black" style={{ background: '#d4f53c', color: '#17240a' }}>Review and send →</Link>}
            </div>
          ) : contactInfo.reminderDue > 0 ? (
            <div className="rounded-[18px] p-4 mb-3 flex items-center gap-4" data-testid="contacts-reminder-due" style={{ background: 'rgba(212,245,60,0.09)', border: '1px solid rgba(212,245,60,0.45)' }}>
              <div className="min-w-0 flex-1"><div className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{contactInfo.reminderDue} {contactInfo.reminderDue === 1 ? 'person has' : 'people have'} not joined since their invite</div><div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>You can send one reminder. They will not get another.</div></div>
              {canImport && <button type="button" onClick={() => setReminding(true)} data-testid="contacts-remind" className="shrink-0 rounded-full px-5 py-2.5 text-[13px] font-black" style={{ background: '#d4f53c', color: '#17240a' }}>Send the reminder →</button>}
            </div>
          ) : (
            <p className="text-[12.5px] mb-3" style={{ color: 'var(--text-muted)' }} data-testid="contacts-note">
              {contactInfo.reminderSent > 0 && contactInfo.invited === contactInfo.reminderSent ? 'The reminder has been sent. No more will be sent to these people.'
                : contactInfo.nextReminderOn ? `You can send one reminder from ${new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'long', timeZone: 'Pacific/Auckland' }).format(new Date(contactInfo.nextReminderOn))}.` : ''}
            </p>
          )}
          <div className="rounded-[20px] overflow-hidden" style={card} data-testid="contacts-list">
            {liveContacts.length === 0 ? <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>Nobody matches that.</div> : liveContacts.slice(0, shown).map(c => (
              <div key={c.id} data-testid="contact-row" className="flex items-center gap-3 px-4 lg:px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <span aria-hidden className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-black" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }}>{initials(c.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5"><span className="text-[15px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                    <span className="text-[10px] font-black rounded-full px-2 py-0.5" data-testid="contact-tag" style={{ background: 'rgba(134,187,247,0.14)', color: 'var(--brand-primary-text)', border: '1px solid rgba(134,187,247,0.5)' }}>{contactLabel(c)}</span></span>
                  <span className="block text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{c.email} · {c.lastPlayed ? `Last played ${new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${c.lastPlayed}T12:00:00Z`))} · from your file` : 'No date in your file'}</span>
                </span>
              </div>
            ))}
          </div>
          {liveContacts.length > shown && <button type="button" onClick={() => setShown(n => n + PAGE)} className="w-full mt-3 rounded-2xl py-3 text-[13.5px] font-extrabold" style={{ ...card, color: 'var(--brand-primary-text)' }}>Show more</button>}
          <p className="text-[12px] mt-3 text-center" style={{ color: 'var(--text-subtle)' }}>These people have not made an account, so they cannot book yet. Dates are from your file, not PadelMate bookings.{contactInfo.unsubscribed > 0 ? ` ${contactInfo.unsubscribed} unsubscribed and are not shown.` : ''}</p>
          {reminding && <ReminderSheet venueSlug={venueSlug} club={club} count={contactInfo.reminderDue} emailReady={emailReady} onClose={() => setReminding(false)} />}
        </div>
      ) : (<>

      {quiet && counts.quiet > 0 && (
        <div className="rounded-[18px] p-4 mb-3 flex items-center gap-4" data-testid="quiet-banner" style={{ background: 'rgba(212,245,60,0.09)', border: '1px solid rgba(212,245,60,0.45)' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{counts.quiet} {counts.quiet === 1 ? 'player hasn' : 'players haven'}&apos;t played in 30 days</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{showMoney ? <>Together they have booked <b style={{ color: 'var(--text-primary)' }}>{formatPrice(groupBooked(group), currency)}</b> here. </>: null}A message is the cheapest way to bring them back.</div>
          </div>
          {canMessage && <button type="button" onClick={() => setTarget({ segment: 'quiet', count: counts.quiet })} data-testid="message-quiet" className="hidden sm:inline-flex shrink-0 rounded-full px-5 py-3 text-[14px] font-black" style={{ background: '#d4f53c', color: '#17240a' }}>{counts.quiet === 1 ? 'Message them' : `Message all ${counts.quiet}`} →</button>}
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl text-center py-10 text-sm" data-testid="players-empty" style={{ ...card, color: 'var(--text-muted)' }}>
          {players.length === 0 ? <>Nobody has booked at your club yet. Players appear here after their first booking.{canImport && <> Already have a list? <Link href={`/players/import?venue=${venueSlug}`} className="font-bold underline" style={{ color: 'var(--brand-primary-text)' }}>Import your players</Link>.</>}</> : 'Nobody matches that.'}
        </div>
      ) : (
        <div className="rounded-[20px] overflow-hidden" style={card} data-testid="players-list">
          <div className="hidden lg:grid items-center gap-3 px-5 py-3 text-[11px] font-extrabold uppercase" style={{ gridTemplateColumns: showMoney ? '2.4fr 1.3fr 0.7fr 0.9fr 0.9fr' : '2.4fr 1.3fr 0.7fr 0.9fr', letterSpacing: '0.1em', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)' }}>
            <span>Player</span><span>Last played</span><span>Games</span>{showMoney && <span>Booked</span>}<span />
          </div>
          {list.slice(0, shown).map(p => (
            <div key={p.id} data-testid="player-row" className="flex lg:grid items-center gap-3 px-4 lg:px-5 py-3.5" style={{ gridTemplateColumns: showMoney ? '2.4fr 1.3fr 0.7fr 0.9fr 0.9fr' : '2.4fr 1.3fr 0.7fr 0.9fr', borderBottom: '1px solid var(--border)' }}>
              <Link href={`/players/${p.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                <span aria-hidden className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-black" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }}>{initials(p.name)}</span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="text-[11.5px] lg:hidden" style={{ color: 'var(--text-muted)' }}>{lastPlayedLabel(p, today)} · {p.games} {p.games === 1 ? 'game' : 'games'}</span>
                    <span className="text-[10px] font-black rounded-full px-2 py-0.5" style={p.member ? { background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' } : { background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>{p.member ? (p.planLabel ?? 'Member') : 'Casual'}</span>
                    {p.viaLink && <span className="text-[10px] font-black rounded-full px-2 py-0.5" data-testid="via-link-tag" style={{ background: 'rgba(212,245,60,0.14)', color: '#d4f53c', border: '1px solid rgba(212,245,60,0.45)' }}>via link</span>}
                    {p.owes > 0 && showMoney && <span className="text-[10px] font-black rounded-full px-2 py-0.5" style={{ background: '#d4f53c', color: '#17240a' }}>owes {p.owes}</span>}
                  </span>
                </span>
              </Link>
              <span className="hidden lg:block text-[13.5px]" style={{ color: 'var(--text-muted)' }}>{lastPlayedLabel(p, today)}</span>
              <b className="hidden lg:block text-[14px]" style={{ color: 'var(--text-primary)' }}>{p.games}</b>
              {showMoney && <b className="hidden lg:block text-[14px]" style={{ color: 'var(--text-primary)' }}>{formatPrice(p.booked, currency)}</b>}
              <span className="shrink-0 lg:text-right">
                {canMessage ? <button type="button" onClick={() => setTarget({ playerId: p.id, name: p.name })} data-testid="message-one" className="rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary-text)' }}>Message</button> : <span style={{ color: 'var(--text-subtle)' }}>›</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {list.length > shown && (
        <button type="button" onClick={() => setShown(s => s + PAGE)} data-testid="show-more" className="w-full mt-3 rounded-2xl py-3 text-[13.5px] font-extrabold" style={{ ...card, color: 'var(--brand-primary-text)' }}>Show more · {list.length - shown} left</button>
      )}
      <p className="text-[12px] mt-3 text-center" style={{ color: 'var(--text-subtle)' }}>Showing {Math.min(shown, list.length)} of {list.length} · tap a player for their full history{showMoney ? ' · Booked is the court value of the games they played here' : ''}</p>

      {canMessage && group.length > 0 && segment !== 'all' && (
        <div className="sticky mt-4 rounded-[18px] px-4 py-3 flex items-center gap-3 sm:hidden" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))', background: 'var(--brand-primary)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <b className="flex-1 text-[14px] text-white">{group.length === 1 ? 'Message this player' : `Message these ${group.length}`}</b>
          <button type="button" onClick={() => setTarget({ segment, count: group.length })} data-testid="message-group-phone" className="rounded-full px-4 py-2 text-[13px] font-black" style={{ background: '#d4f53c', color: '#17240a' }}>Write →</button>
        </div>
      )}
      {canMessage && group.length > 0 && segment !== 'all' && segment !== 'quiet' && (
        <div className="hidden sm:flex justify-end mt-4"><button type="button" onClick={() => setTarget({ segment, count: group.length })} data-testid="message-group" className="rounded-full px-5 py-3 text-[14px] font-black" style={{ background: '#d4f53c', color: '#17240a' }}>{group.length === 1 ? 'Message this player' : `Message these ${group.length}`} →</button></div>
      )}
      </>)}
      {target && <MessageSheet venueSlug={venueSlug} club={club} target={target} onClose={() => setTarget(null)} />}
    </div>
  )
}
