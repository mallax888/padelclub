import { initialsOf } from '@/lib/club-map'

// Your next game as a padel court seen from above: you and the people already in on the left and right of the net, a dashed
// seat for every spot still open, and the court number on a white tile at the net. A dashed seat opens My bookings, where friends are invited.
const SEATS = [{ x: 82, y: 238 }, { x: 82, y: 96 }, { x: 458, y: 96 }, { x: 458, y: 238 }]

export default function NextGameCourt({ courtName, names, inviteHref }: { courtName: string; names: string[]; inviteHref: string }) {
  const bare = courtName.replace(/^court\s*/i, '').trim()
  const short = bare.length > 0 && bare.length <= 3 ? bare : bare.slice(0, 1).toUpperCase()
  const seated = names.slice(0, 4)
  return (
    <svg viewBox="0 0 540 330" className="block w-full h-auto" role="img" aria-label={`${courtName}: ${seated.length} of 4 seats taken`} data-testid="next-game-court" fontFamily="inherit">
      <defs><linearGradient id="home-court" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2b6bd1" /><stop offset="1" stopColor="#1b4aa6" /></linearGradient></defs>
      <rect x="6" y="6" width="528" height="318" rx="30" fill="none" stroke="#ffffff55" strokeWidth="3" />
      <rect x="14" y="14" width="512" height="302" rx="22" fill="none" stroke="#ffffff22" strokeWidth="2" />
      <rect x="24" y="24" width="492" height="282" rx="14" fill="url(#home-court)" />
      <g stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.92">
        <rect x="24" y="24" width="492" height="282" rx="14" /><line x1="140" y1="24" x2="140" y2="306" /><line x1="400" y1="24" x2="400" y2="306" /><line x1="140" y1="165" x2="400" y2="165" />
      </g>
      <line x1="270" y1="14" x2="270" y2="316" stroke="#e8f0ff" strokeWidth="5" strokeDasharray="2 6" strokeLinecap="round" opacity="0.95" />
      <circle cx="270" cy="14" r="6" fill="#e8f0ff" /><circle cx="270" cy="316" r="6" fill="#e8f0ff" />
      <g textAnchor="middle" fontWeight="900">
        <rect x="224" y="119" width="92" height="92" rx="22" fill="#ffffff" />
        <text x="270" y="148" fontSize="11" letterSpacing="2" fill="#667085">COURT</text>
        <text x="270" y="198" fontSize={short.length > 2 ? 34 : 52} fill="#1d3f8d">{short}</text>
        {SEATS.map((p, i) => {
          const n = seated[i]
          if (n) {
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="30" fill={i === 0 ? '#ffffff' : '#d4f53c'} stroke="#2352b3" strokeWidth="3" />
                <text x={p.x} y={p.y + 6} fontSize="17" fill={i === 0 ? '#1d3f8d' : '#17240a'}>{initialsOf(n)}</text>
                <text x={p.x} y={p.y + 46} fontSize="12" fontWeight="700" fill="#cfe0ff">{i === 0 ? 'You' : n.split(' ')[0]}</text>
              </g>
            )
          }
          return (
            <a key={i} href={inviteHref} aria-label="Invite a friend" data-testid="invite-seat">
              <circle cx={p.x} cy={p.y} r="30" fill="#ffffff01" stroke="#ffffff" strokeWidth="3" strokeDasharray="6 6" />
              <text x={p.x} y={p.y + 10} fontSize="28" fill="#ffffff">+</text>
              <text x={p.x} y={p.y + 46} fontSize="12" fontWeight="700" fill="#cfe0ff">Invite</text>
            </a>
          )
        })}
      </g>
    </svg>
  )
}
