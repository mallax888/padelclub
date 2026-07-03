const fs = require('fs');
const path = 'components/matches/RecordMatchForm.tsx';
const c = fs.readFileSync(path, 'utf8');

const idx = c.indexOf('const handleSubmit');
const endMarker = "setSubmitting(false)\n  }";
const end = c.indexOf(endMarker, idx) + endMarker.length;

if (idx === -1 || end === -1) {
  console.log('Boundaries not found. idx:', idx, 'end:', end);
  process.exit(1);
}

const replacement = `const handleSubmit = async () => {
    if (!team1p1 || !team2p1) { toast.error('Please select at least one player per team'); return }
    if (!matchWinner) { toast.error('Match is not complete yet'); return }
    setSubmitting(true)

    const res = await fetch('/api/record-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team1p1, team1p2, team2p1, team2p2, sets, matchWinner, notes }),
    })
    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error || 'Could not record match')
      setSubmitting(false)
      return
    }

    toast.success('Match recorded! Leaderboard updated.')
    router.push('/players')
    router.refresh()
    setSubmitting(false)
  }`;

const newContent = c.slice(0, idx) + replacement + c.slice(end);
fs.writeFileSync(path, newContent, 'utf8');
console.log('Boundaries found:', idx !== -1 && end !== -1);
console.log('Now calls /api/record-match:', newContent.includes("fetch('/api/record-match'"));
console.log('Old direct supabase insert removed:', !newContent.includes("sb.from('matches').insert"));
