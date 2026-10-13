function marginMultiplier(diff) {
  if (diff <= 1) return 1;
  if (diff === 2) return 1.5;
  return (11 + diff) / 8;
}

// Chance (0 to 1) that `rating` beats `opponent`.
export function expected(rating, opponent) {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

// One player's Elo change in a game, from a computeElo history entry.
export const eloChange = (entry, m, id) => m.home_team_id === id ? entry.deltaHome : entry.deltaAway;

// Replays every match in order. Returns current ratings and full history.
// A player's first `provisionalGames` games use a bigger K (times provisionalFactor),
// so new players settle fast. The two sides of a game can then change by
// different amounts, so history keeps both: deltaHome and deltaAway.
export function computeElo(teams, matches, cfg) {
  const ratings = new Map(teams.map(t => [t.id, cfg.start]));
  const played = new Map();
  const history = [];
  const boost = id => (played.get(id) ?? 0) < (cfg.provisionalGames ?? 0) ? (cfg.provisionalFactor ?? 1) : 1;

  for (const m of matches) {
    const h = m.home_team_id, a = m.away_team_id;
    if (!ratings.has(h)) ratings.set(h, cfg.start);
    if (!ratings.has(a)) ratings.set(a, cfg.start);

    const rh = ratings.get(h), ra = ratings.get(a);

    // 1 = home win, 0 = away win, 0.5 = draw (shootouts count as draws)
    const result = m.home_goals > m.away_goals ? 1
                 : m.home_goals < m.away_goals ? 0 : 0.5;

    const k = { league: cfg.k, playoff: cfg.kPlayoff, friendly: cfg.kFriendly }[m.stage] ?? cfg.k;
    const g = marginMultiplier(Math.abs(m.home_goals - m.away_goals));
    const exp = expected(rh, ra);
    const base = k * g * (result - exp);
    const deltaHome = base * boost(h);
    const deltaAway = -base * boost(a);

    ratings.set(h, rh + deltaHome);
    ratings.set(a, ra + deltaAway);
    played.set(h, (played.get(h) ?? 0) + 1);
    played.set(a, (played.get(a) ?? 0) + 1);
    // homeExpected: the home player's pre-game win chance, used to spot upsets
    history.push({ matchId: m.id, playedAt: m.played_at,
                   [h]: rh + deltaHome, [a]: ra + deltaAway,
                   deltaHome, deltaAway, delta: deltaHome, homeExpected: exp });
  }

  return { ratings, history };
}
