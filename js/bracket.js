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

// Standard bracket order, so the top seeds can only meet late:
// 2 -> [1,2], 4 -> [1,4,2,3], 8 -> [1,8,4,5,2,7,3,6], ...
function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    order = order.flatMap(s => [s, n - s]);
  }
  return order;
}

const ROUND_NAMES = { 1: "Final", 2: "Semifinals", 4: "Quarterfinals", 8: "Round of 16", 16: "Round of 32" };

// Single-game knockout for the top `spots` teams (any number).
// If the bracket isn't full (e.g. 6 teams in an 8-team bracket), the top seeds get byes.
export function buildBracket(standings, matches, spots = 4) {
  const n = Math.min(spots, standings.length);
  const seeds = standings.slice(0, n).map(r => r.team.id);
  const playoffs = matches.filter(m => m.stage === "playoff");
  if (n < 2) return { seeds, rounds: [], champion: null };

  let size = 2;
  while (size < n) size *= 2;

  // `bye`: in the first round, a team with no opponent goes straight through.
  // Later rounds never use it: an empty slot there just means a game isn't played yet.
  const tie = (a, b, { bye = false } = {}) => {
    a = a ?? null;
    b = b ?? null;
    const match = findMatch(playoffs, a, b);
    const oneSided = (a == null) !== (b == null);
    let winner = match ? winnerOf(match) : null;
    if (!match && bye && oneSided) winner = a ?? b;
    return { a, b, match, winner, bye: bye && oneSided };
  };

  const order = seedOrder(size);
  const rounds = [];
  let ties = [];
  for (let i = 0; i < size; i += 2) {
    ties.push(tie(seeds[order[i] - 1], seeds[order[i + 1] - 1], { bye: true }));
  }
  rounds.push({ name: ROUND_NAMES[ties.length] ?? `Round of ${ties.length * 2}`, ties });
  while (ties.length > 1) {
    const next = [];
    for (let i = 0; i < ties.length; i += 2) next.push(tie(ties[i].winner, ties[i + 1].winner));
    ties = next;
    rounds.push({ name: ROUND_NAMES[ties.length] ?? `Round of ${ties.length * 2}`, ties });
  }

  return { seeds, rounds, champion: rounds.at(-1).ties[0].winner };
}
