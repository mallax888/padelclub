const fs = require('fs');
let c = fs.readFileSync('components/matches/RecordMatchForm.tsx', 'utf8');

// Replace openSet function to accept a team parameter
c = c.replace(
  `  const openSet = (setIndex: number) => {
    if (activeSet === setIndex) {
      setActiveSet(null)
      setActiveTeam(1)
      setPendingT1(null)
    } else {
      setActiveSet(setIndex)
      setActiveTeam(1)
      setPendingT1(null)
    }
  }`,
  `  const openSet = (setIndex: number, team: 1 | 2 = 1) => {
    if (activeSet === setIndex && activeTeam === team) {
      setActiveSet(null)
      setActiveTeam(1)
      setPendingT1(null)
    } else {
      setActiveSet(setIndex)
      setActiveTeam(team)
      if (team === 2 && sets[setIndex] !== undefined) {
        setPendingT1(sets[setIndex].t1)
      } else {
        setPendingT1(null)
      }
    }
  }`
);

// Update T1 bubble click to open for team 1
c = c.replace(
  `          <div style={t1Style} onClick={() => openSet(setIndex)}>`,
  `          <div style={t1Style} onClick={() => openSet(setIndex, 1)}>`
);

// Update T2 bubble click to open for team 2
c = c.replace(
  `          <div style={t2Style} onClick={() => openSet(setIndex)}>`,
  `          <div style={t2Style} onClick={() => openSet(setIndex, 2)}>`
);

fs.writeFileSync('components/matches/RecordMatchForm.tsx', c, 'utf8');
console.log('Done - openSet:', c.includes('team: 1 | 2 = 1') ? 'OK' : 'FAILED');
