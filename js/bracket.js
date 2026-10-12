// Who won a match. Returns a team id, or null if undecided.
export function winnerOf(m) {
  if (m.home_goals !== m.away_goals) {
    return m.home_goals > m.away_goals ? m.home_team_id : m.away_team_id;
  }
  if (m.home_pens != null && m.away_pens != null) {
    return m.home_pens > m.away_pens ? m.home_team_id : m.away_team_id;
  }
  return null;
}

// Find the playoff match between two teams, whichever was home.
function findMatch(playoffs, a, b) {
  if (a == null || b == null) return null;
  return playoffs.find(m =>
    (m.home_team_id === a && m.away_team_id === b) ||
    (m.home_team_id === b && m.away_team_id === a)) ?? null;
}

// 4-team bracket: 1v4 and 2v3 semis, then a final. With 3 teams, 1st gets a bye.
export function buildBracket(standings, matches) {
  const seeds = standings.slice(0, 4).map(r => r.team.id);
  const playoffs = matches.filter(m => m.stage === "playoff");

  // `bye`: in the semis, a team with no opponent (fewer than 4 teams) goes straight through.
  // Never used for the final, where an empty slot just means a semi isn't finished yet.
  const tie = (a, b, { bye = false } = {}) => {
    a = a ?? null;
    b = b ?? null;
    const match = findMatch(playoffs, a, b);
    const oneSided = (a == null) !== (b == null);
    let winner = match ? winnerOf(match) : null;
    if (!match && bye && oneSided) winner = a ?? b;
    return { a, b, match, winner, bye: bye && oneSided };
  };

  const semi1 = tie(seeds[0], seeds[3], { bye: true });
  const semi2 = tie(seeds[1], seeds[2], { bye: true });
  const final = tie(semi1.winner, semi2.winner);

  return {
    seeds,
    rounds: [
      { name: "Semifinals", ties: [semi1, semi2] },
      { name: "Final", ties: [final] },
    ],
    champion: final.winner,
  };
}
