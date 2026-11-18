'use client'

import { initialsOf } from '@/lib/club-map'

// The booking summary on the last screens of Book a court: a ticket for the game. The court is a white tile, the time is the
// hero, and under the tear line sit who is playing and what you pay. One colour for every amount: white.
const FACE = 'linear-gradient(160deg, #2c5fc4, #1d3f8d)'
const INK = '#ffffff'
const SOFT = '#cfe0ff'
function Ball({ name }: { name: string }) {
  const bare = name.replace(/^court\s*/i, '').trim()
  const short = bare.length > 0 && bare.length <= 3 ? bare : bare.slice(0, 1).toUpperCase()
  return (
    <div className="shrink-0 flex flex-col items-center justify-center" aria-hidden
      style={{ width: 78, height: 78, borderRadius: 20, background: '#ffffff', color: '#1d3f8d', boxShadow: '0 2px 0 rgba(0,0,0,0.2)' }}>
      <span className="text-[9.5px] font-black" style={{ letterSpacing: '0.14em', color: '#667085' }}>COURT</span>
      <span className="font-black leading-[0.95]" style={{ fontSize: short.length > 2 ? 26 : 36 }} data-testid="ticket-court">{short}</span>
    </div>
  )
}

function Avatars({ names }: { names: string[] }) {
  const shown = names.slice(0, 3)
  return (
    <span className="flex shrink-0">
      {shown.map((n, i) => (
        <span key={i} className="flex items-center justify-center rounded-full font-black"
          style={{ width: 38, height: 38, fontSize: 11, marginLeft: i ? -5 : 0, border: '2px solid #2352b3', background: i === 0 ? '#ffffff' : '#d4f53c', color: i === 0 ? '#1d3f8d' : '#17240a' }}>{initialsOf(n)}</span>
      ))}
    </span>
  )
}

export default function BookingTicket({ courtName, dateLabel, time, endTime, lengthLabel, venueName, you, friends, who, weekly, priceLabel, price, courtTotal, onEdit, onChangeVenue, onChangePlayers, onChangeWeekly }: {
  courtName: string; dateLabel: string; time: string; endTime: string; lengthLabel: string; venueName: string
  you: string; friends: string[]
  // who: undefined while the question is still open, otherwise the words for the line ("You + Jonesy", "Just you")
  who?: string; weekly?: string
  priceLabel: string; price: string; courtTotal?: string
  onEdit?: () => void; onChangeVenue?: () => void; onChangePlayers?: () => void; onChangeWeekly?: () => void
}) {
  const bare = courtName.replace(/^court\s*/i, '').trim()
  const named = !(bare.length > 0 && bare.length <= 3)
  return (
    <div data-testid="answered-booking">
      <div className="relative" style={{ color: INK, background: FACE, borderRadius: 24 }}>
        <div className="flex items-center gap-4 px-5 pt-5 pb-5">
          <Ball name={courtName} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold uppercase truncate" style={{ letterSpacing: '0.12em', color: SOFT }}>{named ? `${courtName} · ` : ''}{dateLabel}</div>
            <div className="font-black leading-none" style={{ fontSize: 40, letterSpacing: '-0.03em' }} data-testid="ticket-time">{time}</div>
            <div className="text-[15px] font-bold mt-1.5" style={{ color: SOFT }}>until {endTime} · {lengthLabel}</div>
          </div>
        </div>
        <div className="relative" style={{ height: 0 }} aria-hidden>
          <div style={{ position: 'absolute', left: 20, right: 20, top: -1, borderTop: '2px dashed #ffffff55' }} />
          <span style={{ position: 'absolute', left: -13, top: -13, width: 26, height: 26, borderRadius: 13, background: 'var(--bg-base)' }} />
          <span style={{ position: 'absolute', right: -13, top: -13, width: 26, height: 26, borderRadius: 13, background: 'var(--bg-base)' }} />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-4">
          <div className="min-w-0 flex flex-col gap-1.5 items-start">
            {who !== undefined && (
              <button type="button" onClick={onChangePlayers} aria-label="Change Playing with" data-testid="answered-players" className="flex items-center gap-2.5 text-left min-w-0">
                <Avatars names={[you, ...friends]} />
                <span className="text-[15px] font-extrabold truncate">{who}</span>
              </button>
            )}
            {weekly !== undefined && (
              <button type="button" onClick={onChangeWeekly} aria-label="Change Every week" data-testid="answered-regular" className="text-[12.5px] font-semibold text-left" style={{ color: SOFT }}>{weekly}</button>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.1em', color: SOFT }}>{priceLabel}</div>
            <div className="font-black leading-[1.05]" style={{ fontSize: 30, letterSpacing: '-0.02em' }} data-testid="ticket-price">{price}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-1.5 pt-2.5">
        <span className="text-[13px] min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>
          {onChangeVenue
            ? <button type="button" onClick={onChangeVenue} aria-label="Change Where" data-testid="answered-where" className="font-semibold">{venueName}</button>
            : venueName}
          {courtTotal ? ` · ${courtTotal} court` : ''}
        </span>
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label="Change Your booking" className="text-[13px] font-extrabold rounded-full px-3.5 py-1.5 shrink-0"
            style={{ background: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Edit</button>
        )}
      </div>
    </div>
  )
}
