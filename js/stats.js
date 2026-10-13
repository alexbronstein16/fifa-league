// League-wide stats: season awards and the clubs table.
// Pure functions: data in, numbers out. `history` comes from computeElo and
// lines up 1:1 with `allMatches`.

const resultFor = (m, id) => {
  const home = m.home_team_id === id;
  const gf = home ? m.home_goals : m.away_goals;
  const ga = home ? m.away_goals : m.home_goals;
  return { gf, ga, r: gf > ga ? "W" : gf < ga ? "L" : "D" };
};

// ---------- season awards ----------
// Returns a list of { key, label, teamId, value, detail, other } (other = opponent id, if any).
export function seasonAwards({ season, allMatches, history, leagueIds }) {
  const inSeason = [];  // [match, index into history]
  allMatches.forEach((m, i) => { if (m.season === season) inSeason.push([m, i]); });
  const competitive = inSeason.filter(([m]) => m.stage !== "friendly");
  const awards = [];

  // golden boot + best defense: league and playoff games
  const tally = new Map();
  for (const [m] of competitive) {
    for (const id of [m.home_team_id, m.away_team_id]) {
      if (!leagueIds.has(id)) continue;
      const { gf, ga } = resultFor(m, id);
      const t = tally.get(id) ?? { gp: 0, gf: 0, ga: 0 };
      t.gp++; t.gf += gf; t.ga += ga;
      tally.set(id, t);
    }
  }
  const rows = [...tally].map(([id, t]) => ({ id, ...t }));
  const boot = rows.sort((a, b) => b.gf - a.gf || a.gp - b.gp)[0];
  if (boot?.gf) awards.push({ key: "boot", label: "Golden boot", teamId: boot.id,
    value: `${boot.gf} goals`, detail: `in ${boot.gp} games` });

  const maxGp = Math.max(0, ...rows.map(r => r.gp));
  const minGp = Math.max(2, Math.ceil(maxGp / 2));  // need a fair share of games to qualify
  const wall = rows.filter(r => r.gp >= minGp)
    .sort((a, b) => a.ga / a.gp - b.ga / b.gp || b.gp - a.gp)[0];
  if (wall) awards.push({ key: "wall", label: "Best defense", teamId: wall.id,
    value: `${(wall.ga / wall.gp).toFixed(1)} conceded`, detail: `per game · ${wall.gp} games` });

  // biggest win: league and playoffs
  let big = null;
  for (const [m] of competitive) {
    const margin = Math.abs(m.home_goals - m.away_goals);
    if (margin && (!big || margin > big.margin)) big = { m, margin };
  }
  if (big) {
    const homeWon = big.m.home_goals > big.m.away_goals;
    const w = homeWon ? big.m.home_team_id : big.m.away_team_id;
    const l = homeWon ? big.m.away_team_id : big.m.home_team_id;
    awards.push({ key: "big", label: "Biggest win", teamId: w, other: l,
      value: `${Math.max(big.m.home_goals, big.m.away_goals)}–${Math.min(big.m.home_goals, big.m.away_goals)}`, detail: "vs" });
  }

  // biggest upset: any game type, lowest pre-game chance for the winner
  let upset = null;
  for (const [m, i] of inSeason) {
    if (m.home_goals === m.away_goals) continue;
    const homeWon = m.home_goals > m.away_goals;
    const chance = homeWon ? history[i].homeExpected : 1 - history[i].homeExpected;
    if (chance < 0.4 && (!upset || chance < upset.chance)) {
      upset = { chance, w: homeWon ? m.home_team_id : m.away_team_id, l: homeWon ? m.away_team_id : m.home_team_id };
    }
  }
  if (upset) awards.push({ key: "upset", label: "Biggest upset", teamId: upset.w, other: upset.l,
    value: `${Math.round(upset.chance * 100)}% chance`, detail: "beat" });

  // longest win streak and most improved: any game type
  const streak = new Map(), best = new Map(), gain = new Map();
  for (const [m, i] of inSeason) {
    for (const id of [m.home_team_id, m.away_team_id]) {
      const { r } = resultFor(m, id);
      const s = r === "W" ? (streak.get(id) ?? 0) + 1 : 0;
      streak.set(id, s);
      best.set(id, Math.max(best.get(id) ?? 0, s));
      const d = m.home_team_id === id ? history[i].delta : -history[i].delta;
      gain.set(id, (gain.get(id) ?? 0) + d);
    }
  }
  const [hotId, hot] = [...best].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (hot >= 2) awards.push({ key: "streak", label: "Longest win streak", teamId: hotId,
    value: `${hot} wins`, detail: "in a row" });
  const [upId, up] = [...gain].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (up >= 1) awards.push({ key: "improved", label: "Most improved", teamId: upId,
    value: `+${Math.round(up)} Elo`, detail: "this season" });

  return awards;
}

// Best guest: highest current Elo among non-league players who've played.
export function bestGuest(ratings, guestIds, playedIds) {
  const g = [...guestIds].filter(id => playedIds.has(id))
    .sort((a, b) => (ratings.get(b) ?? 0) - (ratings.get(a) ?? 0))[0];
  return g == null ? null : { key: "guest", label: "Best guest", teamId: g,
    value: `${Math.round(ratings.get(g))} Elo`, detail: "" };
}

// ---------- clubs ----------
// One row per club (grouped case-insensitively) across every game it was recorded in.
export function clubTable(matches) {
  const byClub = new Map();
  for (const m of matches) {
    for (const [id, club] of [[m.home_team_id, m.home_club], [m.away_team_id, m.away_club]]) {
      const name = (club ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const row = byClub.get(key) ?? { club: name, gp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, users: new Map() };
      const { gf, ga, r } = resultFor(m, id);
      row.gp++; row.gf += gf; row.ga += ga;
      row[r.toLowerCase()]++;
      const u = row.users.get(id) ?? { gp: 0, w: 0 };
      u.gp++; if (r === "W") u.w++;
      row.users.set(id, u);
      byClub.set(key, row);
    }
  }
  return [...byClub.values()].map(r => {
    // "best with it": most wins with the club, then fewest games
    const [topId, top] = [...r.users].sort((a, b) => b[1].w - a[1].w || a[1].gp - b[1].gp)[0];
    return { ...r, winPct: r.w / r.gp, topId, topW: top.w, topGp: top.gp };
  }).sort((a, b) => b.gp - a.gp || b.winPct - a.winPct);
}
