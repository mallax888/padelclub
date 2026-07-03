const fs = require('fs');
const path = 'components/matches/RecordMatchForm.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = "const { error } = await sb.from('matches').insert({\n      team1_player1_id: team1p1 || null,\n      team1_player2_id: team1p2 || null,\n      team2_player1_id: team2p1 || null,\n      team2_player2_id: team2p2 || null,\n      team1_sets: w1,\n      team2_sets: w2,\n      winner_team: matchWinner,\n      score: scoreText,\n      notes: notes || null,\n      recorded_by: currentUserId,\n      played_at: new Date().toISOString(),\n    })";

const replacement = "const { error } = await sb.from('matches').insert({\n      player1_id: team1p1,\n      player2_id: team2p1,\n      winner_id: matchWinner === 1 ? team1p1 : team2p1,\n      team1_player1_id: team1p1 || null,\n      team1_player2_id: team1p2 || null,\n      team2_player1_id: team2p1 || null,\n      team2_player2_id: team2p2 || null,\n      team1_sets: w1,\n      team2_sets: w2,\n      winner_team: matchWinner,\n      score: scoreText,\n      notes: notes || null,\n      recorded_by: currentUserId,\n      played_at: new Date().toISOString(),\n    })";

console.log('Target found:', c.includes(target));
c = c.replace(target, replacement);
fs.writeFileSync(path, c, 'utf8');
console.log('player1_id/player2_id/winner_id added:', c.includes('player1_id: team1p1,\n      player2_id: team2p1,'));
