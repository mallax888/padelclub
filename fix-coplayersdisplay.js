const fs = require('fs');
const path = 'components/booking/MyBookingsList.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Extend JoinedGame interface to include nested booking_splits
const target1 = `interface JoinedGame {
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
const replacement1 = `interface JoinedGame {
  id: string
  amount_nzd: number
  bookings: {
    date: string
    start_time: string
    end_time: string
    duration_minutes: number
    courts: { name: string; type: string; venue_slug: string } | null
    booking_splits?: { user_id: string; status: string; profiles: { nickname: string | null; full_name: string | null } | null }[]
  } | null
  profiles: { nickname: string | null; full_name: string | null } | null
}`;

console.log('Target 1 found:', c.includes(target1));
c = c.replace(target1, replacement1);

// 2. Accept currentUserId prop
const target2 = `export default function MyBookingsList({
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
const replacement2 = `export default function MyBookingsList({
  bookings,
  profile,
  splitRequests = [],
  outgoingSplits = [],
  joinedGames = [],
  currentUserId,
}: {
  bookings: BookingWithCourt[]
  profile: Profile
  splitRequests?: SplitRequest[]
  outgoingSplits?: OutgoingSplit[]
  joinedGames?: JoinedGame[]
  currentUserId?: string
}) {`;

console.log('Target 2 found:', c.includes(target2));
c = c.replace(target2, replacement2);

// 3. Pass currentUserId down to JoinedGameRow
const target3 = "{upcomingJoined.map(j => <JoinedGameRow key={j.id} game={j} />)}";
const replacement3 = "{upcomingJoined.map(j => <JoinedGameRow key={j.id} game={j} currentUserId={currentUserId} />)}";

console.log('Target 3 found:', c.includes(target3));
c = c.replace(target3, replacement3);

// 4. Update JoinedGameRow to show co-players
const target4 = `function JoinedGameRow({ game: j }: { game: JoinedGame }) {
  const b = j.bookings
  if (!b) return null
  const venue = VENUES.find(v => v.slug === b.courts?.venue_slug)
  const organizerName = j.profiles?.nickname ?? j.profiles?.full_name ?? 'Someone'`;
const replacement4 = `function JoinedGameRow({ game: j, currentUserId }: { game: JoinedGame; currentUserId?: string }) {
  const b = j.bookings
  if (!b) return null
  const venue = VENUES.find(v => v.slug === b.courts?.venue_slug)
  const organizerName = j.profiles?.nickname ?? j.profiles?.full_name ?? 'Someone'
  const coPlayers = (b.booking_splits ?? []).filter(s => s.user_id !== currentUserId)`;

console.log('Target 4 found:', c.includes(target4));
c = c.replace(target4, replacement4);

// 5. Add co-players display after the "Joining X's game" line
const target5 = `            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--brand-accent)' }}>
              Joining {organizerName}'s game
            </div>`;
const replacement5 = `            <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--brand-accent)' }}>
              Joining {organizerName}'s game
            </div>
            {coPlayers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {coPlayers.map(cp => (
                  <span key={cp.user_id} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                    background: cp.status === 'paid' ? 'var(--brand-primary-muted)' : 'rgba(220,50,50,0.1)',
                    color: cp.status === 'paid' ? 'var(--brand-primary)' : '#DC3232',
                    border: cp.status === 'paid' ? '1px solid var(--brand-primary)' : '1px solid #DC3232',
                  }}>
                    {cp.profiles?.nickname ?? cp.profiles?.full_name ?? 'Player'} {cp.status === 'paid' ? '✓' : '⏳'}
                  </span>
                ))}
              </div>
            )}`;

console.log('Target 5 found:', c.includes(target5));
c = c.replace(target5, replacement5);

fs.writeFileSync(path, c, 'utf8');
console.log('Interface extended:', c.includes('booking_splits?:'));
console.log('Prop threaded through:', c.includes('currentUserId={currentUserId}'));
console.log('Co-players filter added:', c.includes('const coPlayers = (b.booking_splits'));
console.log('Co-players display added:', c.includes('coPlayers.map(cp =>'));

const openTags = (c.match(/<a\b/g) || []).length;
const closeTags = (c.match(/<\/a>/g) || []).length;
console.log('Anchor tags balanced:', openTags === closeTags, `(${openTags} open, ${closeTags} close)`);
