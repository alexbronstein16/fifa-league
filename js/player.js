// One match, from one player's point of view.
function fromPerspective(m, id) {
  const home = m.home_team_id === id;
  const gf = home ? m.home_goals : m.away_goals;
  const ga = home ? m.away_goals : m.home_goals;
  return {
    id: m.id,
    stage: m.stage,
    date: m.played_at,
    opp: home ? m.away_team_id : m.home_team_id,
    gf, ga,
    pf: home ? m.home_pens : m.away_pens,
    pa: home ? m.away_pens : m.home_pens,
    forfeit: !!m.forfeit,
    club: home ? m.home_club : m.away_club,
    oppClub: home ? m.away_club : m.home_club,
    result: gf > ga ? "W" : gf < ga ? "L" : "D",
  };
}

// Every game this player played, oldest first, with their Elo after each.
// `history` comes from computeElo and lines up 1:1 with `matches`.
export function playerGames(id, matches, history) {
  const games = [];
  matches.forEach((m, i) => {
    if (m.home_team_id !== id && m.away_team_id !== id) return;
    const g = fromPerspective(m, id);
    g.elo = history[i][id];
    g.eloChange = m.home_team_id === id ? history[i].deltaHome : history[i].deltaAway;
    games.push(g);
  });
  return games;
}

export function summarize(games) {
  const s = {
    gp: games.length, w: 0, d: 0, l: 0, gf: 0, ga: 0,
    cleanSheets: 0, blanks: 0,
    biggestWin: null, worstLoss: null,
    longestWin: 0, longestUnbeaten: 0,
  };

  let winRun = 0, unbeatenRun = 0;
  for (const g of games) {
    s.gf += g.gf;
    s.ga += g.ga;
    if (g.result === "W") s.w++;
    else if (g.result === "D") s.d++;
    else s.l++;
    if (g.ga === 0) s.cleanSheets++;
    if (g.gf === 0) s.blanks++;

    const margin = g.gf - g.ga;
    if (margin > 0 && (!s.biggestWin || margin > s.biggestWin.gf - s.biggestWin.ga)) s.biggestWin = g;
    if (margin < 0 && (!s.worstLoss || margin < s.worstLoss.gf - s.worstLoss.ga)) s.worstLoss = g;

    winRun = g.result === "W" ? winRun + 1 : 0;
    unbeatenRun = g.result !== "L" ? unbeatenRun + 1 : 0;
    s.longestWin = Math.max(s.longestWin, winRun);
    s.longestUnbeaten = Math.max(s.longestUnbeaten, unbeatenRun);
  }

  s.gd = s.gf - s.ga;
  s.winPct = s.gp ? s.w / s.gp : 0;
  s.avgFor = s.gp ? s.gf / s.gp : 0;
  s.avgAgainst = s.gp ? s.ga / s.gp : 0;
  s.form = games.slice(-5).map(g => g.result);

  // current streak: count back from the latest game while the result matches
  s.streak = "–";
  const last = games.at(-1);
  if (last) {
    let n = 0;
    for (let i = games.length - 1; i >= 0 && games[i].result === last.result; i--) n++;
    s.streak = `${last.result}${n}`;
  }
  return s;
}

export function headToHead(games) {
  const byOpp = new Map();
  for (const g of games) {
    const r = byOpp.get(g.opp) ?? { opp: g.opp, gp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    r.gp++;
    r.gf += g.gf;
    r.ga += g.ga;
    r[g.result.toLowerCase()]++;
    byOpp.set(g.opp, r);
  }
  return [...byOpp.values()].sort((a, b) => b.gp - a.gp || (b.w - b.l) - (a.w - a.l));
}

// Record by club, for games where this player's club was recorded.
export function clubStats(games) {
  const byClub = new Map();
  for (const g of games) {
    const name = (g.club ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const r = byClub.get(key) ?? { club: name, gp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    r.gp++;
    r.gf += g.gf;
    r.ga += g.ga;
    r[g.result.toLowerCase()]++;
    byClub.set(key, r);
  }
  return [...byClub.values()].sort((a, b) => b.gp - a.gp || b.w - a.w);
}
