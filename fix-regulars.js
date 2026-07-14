const fs = require('fs');
const path = 'app/(app)/players/[id]/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Add regulars computation right after the h2hList line
const target1 = "  const h2hList = Object.values(h2h).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses)).slice(0, 5)";
const replacement1 = `  const h2hList = Object.values(h2h).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses)).slice(0, 5)

  // Regulars \u2014 most frequent doubles partners (teammates, not opponents)
  const partners: Record<string, { name: string; id: string; together: number; winsTogether: number }> = {}
  for (const m of matches) {
    const onTeam1 = [m.team1_player1?.id, m.team1_player2?.id].includes(params.id)
    const won = (onTeam1 && m.winner_team === 1) || (!onTeam1 && m.winner_team === 2)
    const myPartners = onTeam1
      ? [m.team1_player1, m.team1_player2].filter((p: any) => p?.id && p.id !== params.id)
      : [m.team2_player1, m.team2_player2].filter((p: any) => p?.id && p.id !== params.id)
    for (const p of myPartners) {
      if (!partners[p.id]) partners[p.id] = { name: p.nickname ?? p.full_name ?? 'Unknown', id: p.id, together: 0, winsTogether: 0 }
      partners[p.id].together++
      if (won) partners[p.id].winsTogether++
    }
  }
  const regularsList = Object.values(partners).sort((a, b) => b.together - a.together).slice(0, 5)`;

console.log('Target 1 found:', c.includes(target1));
c = c.replace(target1, replacement1);

// 2. Insert the "Your regulars" card right after the Head to head card closes, before Match history
const target2 = `      {/* Match history */}`;
const replacement2 = `      {/* Regulars */}
      {regularsList.length > 0 && (
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Your regulars</div>
          <div className="space-y-2">
            {regularsList.map(p => {
              const winPct = Math.round((p.winsTogether / p.together) * 100)
              return (
                <Link key={p.id} href={\`/players/\${p.id}\`}>
                  <div className="flex items-center gap-3 py-2 rounded-lg px-2 transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.together} matches together</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--brand-primary-muted)', color: 'var(--brand-primary)' }}>
                      {winPct}% win rate
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Match history */}`;

console.log('Target 2 found:', c.includes(target2));
c = c.replace(target2, replacement2);

fs.writeFileSync(path, c, 'utf8');
console.log('Regulars computation added:', c.includes('const regularsList = Object.values(partners)'));
console.log('Regulars card added:', c.includes("Your regulars"));

const openTags = (c.match(/<a\b/g) || []).length;
const closeTags = (c.match(/<\/a>/g) || []).length;
console.log('Anchor tags balanced:', openTags === closeTags, `(${openTags} open, ${closeTags} close)`);
