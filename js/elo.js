function marginMultiplier(diff) {
  if (diff <= 1) return 1;
  if (diff === 2) return 1.5;
  return (11 + diff) / 8;
}

function expected(rating, opponent) {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

// Replays every match in order. Returns current ratings and full history.
export function computeElo(teams, matches, cfg) {
  const ratings = new Map(teams.map(t => [t.id, cfg.start]));
  const history = [];

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
    const delta = k * g * (result - expected(rh, ra));

    ratings.set(h, rh + delta);
    ratings.set(a, ra - delta);
    history.push({ matchId: m.id, playedAt: m.played_at,
                   [h]: rh + delta, [a]: ra - delta, delta });
  }

  return { ratings, history };
}
