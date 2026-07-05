const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Add JoinedGame interface after SplitRequest interface
const target1 = `interface SplitRequest {
  id: string
  booking_id: string
  amount_nzd: number
  status: string
  bookings: {
    date: string
    start_time: string
    end_time: string
    courts: { name: string; type: string } | null
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}`;
const replacement1 = `interface SplitRequest {
  id: string
  booking_id: string
  amount_nzd: number
  status: string
  bookings: {
    date: string
    start_time: string
    end_time: string
    courts: { name: string; type: string } | null
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}

interface JoinedGame {
  id: string
  amount_nzd: number
  bookings: {
    date: string
    start_time: string
    end_time: string
    duration_minutes: number
    courts: { name: string; type: string; venue_slug: string } | null
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}`;

console.log('Target 1 found:', c.includes(target1));
c = c.replace(target1, replacement1);

// 2. Update function signature to accept joinedGames prop
const target2 = `export default function MyBookingsList({
  bookings,
  profile,
  splitRequests = [],
  outgoingSplits = [],
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
  outgoingSplits?: OutgoingSplit[]
}) {`;
const replacement2 = `export default function MyBookingsList({
  bookings,
  profile,
  splitRequests = [],
  outgoingSplits = [],
  joinedGames = [],
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
  outgoingSplits?: OutgoingSplit[]
  joinedGames?: JoinedGame[]
}) {`;

console.log('Target 2 found:', c.includes(target2));
c = c.replace(target2, replacement2);

// 3. Compute upcoming/past joined games right after the existing upcoming/past split
const target3 = `  const upcoming = bookings.filter(b => b.date >= today && b.status !== 'cancelled')
  const past = bookings.filter(b => b.date < today || b.status === 'cancelled')`;
const replacement3 = `  const upcoming = bookings.filter(b => b.date >= today && b.status !== 'cancelled')
  const past = bookings.filter(b => b.date < today || b.status === 'cancelled')
  const upcomingJoined = joinedGames.filter(j => (j.bookings?.date ?? '') >= today)`;

console.log('Target 3 found:', c.includes(target3));
c = c.replace(target3, replacement3);

// 4. Insert new section after the main Upcoming section, before the past-history block
const target4 = `      {past.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>`;
const replacement4 = `      {upcomingJoined.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Games you've joined</h2>
          <div className="space-y-2">
            {upcomingJoined.map(j => <JoinedGameRow key={j.id} game={j} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>`;

console.log('Target 4 found:', c.includes(target4));
c = c.replace(target4, replacement4);

// 5. Add JoinedGameRow component at the end of the file
const joinedGameRowComponent = `

function JoinedGameRow({ game: j }: { game: JoinedGame }) {
  const b = j.bookings
  if (!b) return null
  const venue = VENUES.find(v => v.slug === b.courts?.venue_slug)
  const organizerName = j.profiles?.nickname ?? j.profiles?.full_name ?? 'Someone'

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: 'var(--brand-accent-muted)' }}>
            🙋
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              {b.courts?.name} — {b.courts?.type}
            </div>
            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--brand-accent)' }}>
              Joining {organizerName}'s game
            </div>
            {venue && (
              <div className="text-sm font-medium mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {venue.name}
              </div>
            )}
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatDate(b.date)} · {b.start_time.slice(0,5)}\u2013{b.end_time.slice(0,5)} · {durationLabel(b.duration_minutes)}
            </div>
            {venue && (
              
                href={\`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(venue.address)}\`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold mt-1.5"
                style={{ color: 'var(--brand-primary)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
                Take me to the court
              </a>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>Paid \u2713</div>
          <div className="text-lg font-bold mt-2" style={{ color: 'var(--brand-primary)' }}>{formatNzd(j.amount_nzd)}</div>
        </div>
      </div>
    </div>
  )
}`;

fs.writeFileSync(path, c + joinedGameRowComponent, 'utf8');

console.log('Interface added:', c.includes('interface JoinedGame'));
console.log('Prop added:', c.includes('joinedGames?: JoinedGame[]'));
console.log('Filter added:', c.includes('const upcomingJoined = joinedGames.filter'));
console.log('Section added:', c.includes("Games you\\'ve joined") || c.includes("Games you've joined"));
