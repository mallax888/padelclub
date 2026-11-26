'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MoneyBubble from '@/components/ui/MoneyBubble'
import MemberPlanDialog from '@/components/admin/MemberPlanDialog'
import type { Plan } from '@/lib/plan-rules'
import { fmtClock } from '@/lib/clock'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import { SEGMENTS, countSegments, daysSince, filterPlayers, groupBooked, lastPlayedLabel, matchesQuery, sortFor, type ClubPlayer, type Segment } from '@/lib/club-players'
import MessageSheet, { type MessageTarget } from '@/components/players/MessageSheet'
import AnnouncementCard from '@/components/admin/AnnouncementCard'
import ReminderSheet from '@/components/players/ReminderSheet'
import { contactLabel, type Contact, type ContactSummary } from '@/lib/contact-rules'

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
const PAGE = 25
const PICKED = { background: 'var(--today-block-bg)', color: 'var(--today-block-fg)', border: '1px solid transparent', boxShadow: 'var(--today-block-shadow)' } as const
// A player's tile wears their plan colour, the same as the plan tiles in Club settings: Casual blue, Pro green, Club (and any plan the club adds) gold.
const planFace = (tier?: string) => !tier || tier === 'casual' ? 'linear-gradient(160deg, #3a73dc, #1d3f8d)' : tier === 'pro' ? 'linear-gradient(160deg, #22b06c, #0f5c38)' : 'linear-gradient(160deg, #d8b200, #8a6f00)'
const dayLabel = (d: string) => d ? new Intl.DateTimeFormat('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)) : ''
function Tile({ name, tier, size = 40 }: { name: string; tier?: string; size?: number }) {
  return <span aria-hidden className="shrink-0 flex items-center justify-center font-black text-white" style={{ width: size, height: size, borderRadius: Math.round(size * 0.31), background: planFace(tier), fontSize: Math.round(size * 0.32), boxShadow: '0 2px 0 rgba(0,0,0,0.2)' }}>{initials(name)}</span>
}

// The owner's list of the club's players: who they are, when they last played and what they have booked, with one tap to
// message a whole group. Front desk gets the same list without the money and without messaging.
export default function ClubPlayers({ players, today, venueSlug, club, currency, showMoney, canMessage, contacts = [], contactInfo = null, canImport = false, emailReady = false, plans = null }: {
  players: ClubPlayer[]; today: string; venueSlug: string; club: string; currency: CurrencyCode; showMoney: boolean; canMessage: boolean
  contacts?: Contact[]; contactInfo?: ContactSummary | null; canImport?: boolean; emailReady?: boolean; plans?: Plan[] | null
}) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [planFor, setPlanFor] = useState<{ id: string; name: string; tier: string } | null>(null)
  const open = openId ? players.find(p => p.id === openId) ?? null : null
  // On a computer a tap opens the player beside the list; on a phone it goes to their page as before.
  const choose = (e: React.MouseEvent, id: string) => { if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) { e.preventDefault(); setOpenId(id) } }
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
  const owingTotal = useMemo(() => players.reduce((t, p) => t + (p.owedAmount ?? 0), 0), [players])
  const names = (ps: ClubPlayer[]) => { const n = ps.map(p => p.name.split(/\s+/)[0] || p.name); return n.length > 3 ? `${n.slice(0, 3).join(', ')} and ${n.length - 3} more` : n.join(', ') }
  const money = (n: number) => formatPrice(n, currency).replace(/\.00$/, '')
  const quietPeople = sortFor(filterPlayers(players, 'quiet', today), 'quiet')
  const needs = [
    ...(showMoney && counts.owes > 0 ? [{ key: 'owes' as Segment, title: 'Owe money', people: filterPlayers(players, 'owes', today), button: counts.owes === 1 ? 'Remind them' : `Remind all ${counts.owes}`, testId: 'remind-owes',
      badge: <MoneyBubble kind="loss" size={12}>{formatPrice(owingTotal, currency).replace(/\.00$/, '')}</MoneyBubble>, act: () => setTarget({ segment: 'owes', count: counts.owes }) }] : []),
    ...(counts.quiet > 0 ? [{ key: 'quiet' as Segment, title: 'Gone quiet', people: sortFor(filterPlayers(players, 'quiet', today), 'quiet'), button: 'Send them a note', testId: 'message-quiet',
      badge: <span className="text-[11.5px] font-extrabold rounded-full px-2.5 py-0.5" style={{ background: 'var(--amber-muted)', color: 'var(--busy-amber)' }}>30+ days</span>, act: () => setTarget({ segment: 'quiet', count: counts.quiet }) }] : []),
    ...(counts.new > 0 ? [{ key: 'new' as Segment, title: 'New this month', people: filterPlayers(players, 'new', today), button: 'Say welcome', testId: 'message-new',
      badge: <span className="text-[11.5px] font-extrabold rounded-full px-2.5 py-0.5" style={{ background: 'rgba(156,194,255,0.14)', color: 'var(--label-blue)' }}>{counts.new} new</span>, act: () => setTarget({ segment: 'new', count: counts.new }) }] : []),
  ]

  // One line per group that needs the owner: what it is, who, and one button. Tapping the words shows that group in the list.
  const needLine = (n: typeof needs[number]) => {
    const one = n.people.length === 1 ? n.people[0] : null
    const text = n.key === 'quiet'
      ? { t: one ? `${one.name} hasn\u2019t played in ${daysSince(one.lastPlayed!, today)} days` : `${n.people.length} players haven\u2019t played in 30 days`, s: `${one ? '' : names(n.people) + ' · '}${showMoney ? `${money(groupBooked(n.people))} booked with you so far` : 'Gone quiet'}` }
      : n.key === 'owes'
        ? { t: `${n.people.length} ${n.people.length === 1 ? 'player owes' : 'players owe'} money`, s: `Owe money · ${names(n.people)}` }
        : { t: `${n.people.length} new ${n.people.length === 1 ? 'player' : 'players'} this month`, s: `New this month · ${names(n.people)}` }
    const tone = n.key === 'owes' ? { bg: 'var(--brand-crimson-muted)', fg: 'var(--brand-crimson)', edge: 'color-mix(in srgb, #c4343a 45%, transparent)', mark: '$' } : n.key === 'quiet' ? { bg: 'var(--amber-muted)', fg: 'var(--busy-amber)', edge: 'color-mix(in srgb, var(--busy-amber) 45%, transparent)', mark: '\u21ba' } : { bg: 'rgba(156,194,255,0.14)', fg: 'var(--label-blue)', edge: 'var(--border)', mark: '+' }
    return (
      <div key={n.key} className="rounded-[16px] px-4 py-3.5 flex items-center gap-3.5 mb-2.5" style={{ background: 'var(--bg-surface)', border: `1px solid ${tone.edge}` }} data-testid={`needs-${n.key}`}>
        <button type="button" onClick={() => pick(n.key)} className="flex items-center gap-3.5 min-w-0 flex-1 text-left" aria-label={`Show ${n.title.toLowerCase()}`}>
          <span aria-hidden className="inline-flex items-center justify-center rounded-[11px] font-extrabold shrink-0" style={{ width: 36, height: 36, background: tone.bg, color: tone.fg }}>{tone.mark}</span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{text.t}</span>
            <span className="block text-[12.5px] mt-0.5 font-semibold truncate" style={{ color: 'var(--text-muted)' }}>{text.s}</span>
          </span>
        </button>
        {n.key === 'owes' && <span className="shrink-0">{n.badge}</span>}
        {canMessage && <button type="button" onClick={n.act} data-testid={n.testId} className="shrink-0 rounded-[11px] px-3.5 text-[12.5px] font-black" style={{ minHeight: 38, background: '#d4f53c', color: '#17240a' }}>{n.button}</button>}
      </div>
    )
  }
  const groupsToMessage = ([['quiet', 'Gone quiet'], ['members', 'Members'], ['new', 'New'], ...(showMoney ? [['owes', 'Owe money']] : [])] as [Segment, string][])
    .filter(([k]) => counts[k] > 0).map(([k, label]) => ({ key: k, label, count: counts[k] }))

  return (
    <div className="w-full lg:flex-1 min-w-0 flex flex-col lg:flex-row gap-6 lg:items-start" data-testid="club-players">
      <div className="flex-1 min-w-0">
      {needs.length > 0 && !viewContacts && (
        <>
          <div className="text-[11px] font-extrabold uppercase mb-2.5 px-0.5" style={{ letterSpacing: '0.12em', color: 'var(--label-blue)' }}>Needs you</div>
          <div className="mb-6" data-testid="needs-you">{needs.map(needLine)}</div>
        </>
      )}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.12em', color: 'var(--label-blue)' }}>{viewContacts ? 'Imported' : 'Everyone'}</span>
        {canImport && <Link href={`/players/import?venue=${venueSlug}`} data-testid="import-link" className="text-[12.5px] font-extrabold" style={{ color: 'var(--label-blue)' }}>Import players</Link>}
      </div>
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
              style={on ? PICKED : { ...card, color: 'var(--text-primary)' }}>
              <span className="lg:hidden">{s.short}</span><span className="hidden lg:inline">{s.label}</span>
              <b className="ml-1.5" style={{ color: on ? 'var(--today-block-fg)' : 'var(--label-blue)' }}>{counts[s.key]}</b>
            </button>
          )
        })}
        {contactInfo && contactInfo.notJoined > 0 && (
          <button type="button" role="tab" aria-selected={viewContacts} data-testid="seg-contacts" onClick={() => pick('contacts')}
            className="shrink-0 rounded-full px-4 py-2.5 text-[13px] font-extrabold whitespace-nowrap"
            style={viewContacts ? PICKED : { ...card, color: 'var(--text-primary)' }}>
            <span className="lg:hidden">Not joined</span><span className="hidden lg:inline">Imported, not joined yet</span>
            <b className="ml-1.5" style={{ color: viewContacts ? 'var(--today-block-fg)' : 'var(--label-blue)' }}>{contactInfo.notJoined}</b>
          </button>
        )}
      </div>


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
        <div className="rounded-[16px] p-4 mb-3 flex items-center gap-4" data-testid="quiet-banner" style={{ ...card, borderLeft: '3px solid var(--busy-amber)' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>{counts.quiet} {counts.quiet === 1 ? 'player hasn' : 'players haven'}&apos;t played in 30 days</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{showMoney ? <>Together they have booked <b style={{ color: 'var(--text-primary)' }}>{formatPrice(groupBooked(group), currency)}</b> here. </>: null}A message is the cheapest way to bring them back.</div>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl text-center py-10 text-sm" data-testid="players-empty" style={{ ...card, color: 'var(--text-muted)' }}>
          {players.length === 0 ? <>Nobody has booked at your club yet. Players appear here after their first booking.{canImport && <> Already have a list? <Link href={`/players/import?venue=${venueSlug}`} className="font-bold underline" style={{ color: 'var(--brand-primary-text)' }}>Import your players</Link>.</>}</> : 'Nobody matches that.'}
        </div>
      ) : (
        <div className="rounded-[20px] overflow-hidden" style={card} data-testid="players-list">
          {list.slice(0, shown).map(p => {
            const on = open?.id === p.id
            return (
            <div key={p.id} data-testid="player-row" data-open={on ? 'true' : undefined} className="flex items-center gap-3 px-4 lg:px-5" style={{ minHeight: 64, borderBottom: '1px solid var(--border)', background: on ? 'var(--bg-raised)' : undefined, boxShadow: on ? 'inset 3px 0 0 var(--today-block-fg)' : undefined }}>
              <Link href={`/players/${p.id}`} onClick={e => choose(e, p.id)} className="flex items-center gap-3 min-w-0 flex-1 py-3">
                <Tile name={p.name} tier={p.tier} />
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
                    <span>{p.member ? (p.planLabel ?? 'Member') : 'Casual'} · {lastPlayedLabel(p, today)}</span>
                    {p.viaLink && <span className="text-[10px] font-black rounded-full px-2 py-0.5" data-testid="via-link-tag" style={{ background: 'rgba(156,194,255,0.14)', color: 'var(--label-blue)' }}>via link</span>}
                  </span>
                </span>
              </Link>
              <span className="shrink-0 text-right">
                {showMoney && p.owes > 0
                  ? <MoneyBubble kind="loss" size={12} testId="row-owes">owes {formatPrice(p.owedAmount ?? 0, currency).replace(/\.00$/, '')}</MoneyBubble>
                  : showMoney && p.booked > 0 ? <span className="text-[13.5px] font-extrabold" style={{ color: 'var(--go-text)' }}>{formatPrice(p.booked, currency)} <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>booked</span></span>
                  : <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{p.games ? `${p.games} ${p.games === 1 ? 'game' : 'games'}` : 'not played yet'}</span>}
              </span>
              {canMessage && <button type="button" onClick={() => setTarget({ playerId: p.id, name: p.name })} data-testid="message-one" className="shrink-0 lg:hidden rounded-full px-3 py-1.5 text-[11.5px] font-extrabold" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Message</button>}
            </div>
          )})}
        </div>
      )}
      {list.length > shown && (
        <button type="button" onClick={() => setShown(s => s + PAGE)} data-testid="show-more" className="w-full mt-3 rounded-2xl py-3 text-[13.5px] font-extrabold" style={{ ...card, color: 'var(--brand-primary-text)' }}>Show more · {list.length - shown} left</button>
      )}
      <p className="text-[12px] mt-3 text-center" style={{ color: 'var(--text-muted)' }}>Showing {Math.min(shown, list.length)} of {list.length} · tap a player for their games{showMoney ? ', plan and money · Booked is the court value of the games they played here' : ''}</p>

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
      </div>

      {/* Owners: message your players, in the right-hand column on a computer (under the list on a phone). It makes way for a player you tap. */}
      {canMessage && (
        <div id="news" className={`scroll-mt-24 w-full lg:w-[360px] shrink-0 lg:sticky lg:top-6${open ? ' lg:hidden' : ''}`}>
          <AnnouncementCard venueSlug={venueSlug} venueName={club} groups={groupsToMessage} onGroup={k => setTarget({ segment: k as Segment, count: counts[k as Segment] })} />
        </div>
      )}
      {/* On a computer: the player you tapped, beside the list. Their plan, their money and their latest games, with the actions. */}
      {open && (
        <aside className="hidden lg:block w-[360px] shrink-0 sticky top-6" data-testid="player-panel">
          <div className="rounded-[20px] p-5" style={{ ...card, boxShadow: 'var(--shadow-float)' }}>
            <div className="flex items-start gap-3.5">
              <Tile name={open.name} tier={open.tier} size={64} />
              <div className="min-w-0 flex-1">
                <div className="text-[20px] font-black leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{open.name}</div>
                <div className="text-[12.5px] mt-1" style={{ color: 'var(--text-muted)' }}>{open.member ? (open.planLabel ?? 'Member') : 'Casual'}{open.joined ? ` · joined ${new Intl.DateTimeFormat('en-NZ', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${open.joined}T12:00:00Z`))}` : ''}</div>
              </div>
              <button type="button" onClick={() => setOpenId(null)} aria-label="Close" className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[16px]" style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)' }}>×</button>
            </div>
            <div className="flex gap-2 mt-4">
              {canMessage && <button type="button" onClick={() => setTarget({ playerId: open.id, name: open.name })} data-testid="panel-message" className="btn-main btn-main-lime flex-1" style={{ minHeight: 44 }}>Message</button>}
              {showMoney && plans && <button type="button" onClick={() => setPlanFor({ id: open.id, name: open.name, tier: open.tier ?? 'casual' })} data-testid="panel-plan" className="flex-1 rounded-xl text-[14px] font-extrabold" style={{ minHeight: 44, background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Change plan</button>}
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <div className="rounded-[16px] p-3.5" style={{ background: 'var(--bg-raised)' }}><div className="text-[11.5px] font-bold" style={{ color: 'var(--text-muted)' }}>Games</div><div className="text-[24px] font-black" style={{ color: 'var(--label-blue)' }}>{open.games}</div></div>
              <div className="rounded-[16px] p-3.5" style={{ background: 'var(--bg-raised)' }}><div className="text-[11.5px] font-bold" style={{ color: 'var(--text-muted)' }}>Credits</div><div className="text-[24px] font-black" style={{ color: 'var(--label-blue)' }}>{open.credits ?? 0}</div></div>
              {showMoney && <div className="rounded-[16px] p-3.5" style={{ background: 'var(--bg-raised)' }}><div className="text-[11.5px] font-bold" style={{ color: 'var(--text-muted)' }}>Booked here</div><div className="text-[20px] font-black" style={{ color: 'var(--go-text)' }}>{formatPrice(open.booked, currency)}</div></div>}
              {showMoney && <div className="rounded-[16px] p-3.5" style={{ background: 'var(--bg-raised)' }}><div className="text-[11.5px] font-bold" style={{ color: 'var(--text-muted)' }}>Owes</div><div className="mt-1">{open.owes > 0 ? <MoneyBubble kind="loss" size={15} testId="panel-owes">{formatPrice(open.owedAmount ?? 0, currency)}</MoneyBubble> : <span className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Nothing</span>}</div></div>}
            </div>
            {showMoney && (open.owing ?? []).length > 0 && (
              <>
                <div className="text-[11px] font-extrabold uppercase mt-5 mb-1.5" style={{ letterSpacing: '0.12em', color: 'var(--label-blue)' }}>Still to pay</div>
                {(open.owing ?? []).map((o, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-[13.5px]" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    <span>{dayLabel(o.date)} · {fmtClock(o.start)}</span><MoneyBubble kind="loss" size={11.5}>{formatPrice(o.amount, currency)}</MoneyBubble>
                  </div>
                ))}
              </>
            )}
            <div className="text-[11px] font-extrabold uppercase mt-5 mb-1.5" style={{ letterSpacing: '0.12em', color: 'var(--label-blue)' }}>Latest games</div>
            {(open.recent ?? []).length === 0 ? <div className="text-[13px] py-2" style={{ color: 'var(--text-muted)' }}>No games here yet.</div> : (open.recent ?? []).map((g, i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }} data-testid="panel-game">
                <span className="w-11 h-10 shrink-0 rounded-[12px] flex flex-col items-center justify-center text-white font-black leading-none" style={{ background: 'linear-gradient(160deg, #3a73dc, #1d3f8d)', fontSize: 12.5 }}>{fmtClock(g.start).split(' ')[0]}<span style={{ fontSize: 9, marginTop: 2 }}>{(fmtClock(g.start).split(' ')[1] ?? '').toUpperCase()}</span></span>
                <span className="text-[13.5px] min-w-0 truncate" style={{ color: 'var(--text-primary)' }}><b>{dayLabel(g.date)}</b> <span style={{ color: 'var(--text-muted)' }}>· {g.court}</span></span>
              </div>
            ))}
            <Link href={`/players/${open.id}`} className="block text-center text-[13px] font-extrabold mt-4" style={{ color: 'var(--label-blue)' }}>Full history →</Link>
          </div>
        </aside>
      )}
      {planFor && plans && <MemberPlanDialog member={planFor} plans={plans} onClose={() => { setPlanFor(null); router.refresh() }} />}
      {target && <MessageSheet venueSlug={venueSlug} club={club} target={target} onClose={() => setTarget(null)} />}
    </div>
  )
}
