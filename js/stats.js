// League-wide stats: awards, leaderboards and the clubs table.
// Pure functions: data in, numbers out.
//
// Most functions take `entries`: a list of [match, i] pairs, where i is the
// match's index in the full match list, so history[i] (from computeElo) gives
// that game's Elo change and pre-game odds. Pick the games you want (a season's
// league games, all friendlies, ...) and every award is computed over just those.

export const entriesFor = (allMatches, keep) => {
  const out = [];
  allMatches.forEach((m, i) => { if (keep(m)) out.push([m, i]); });
  return out;
};

const resultFor = (m, id) => {
  const home = m.home_team_id === id;
  const gf = home ? m.home_goals : m.away_goals;
  const ga = home ? m.away_goals : m.home_goals;
  return { gf, ga, r: gf > ga ? "W" : gf < ga ? "L" : "D" };
};

// ---------- per-player totals ----------
// One row per player: games, W/D/L, goals, clean sheets, Elo gained, streaks.
export function playerTable(entries, history) {
  const rows = new Map();
  for (const [m, i] of entries) {
    for (const id of [m.home_team_id, m.away_team_id]) {
      const { gf, ga, r } = resultFor(m, id);
      const row = rows.get(id) ?? { id, gp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, blanks: 0, elo: 0,
                                     run: 0, bestRun: 0, lossRun: 0, worstRun: 0 };
      row.gp++; row.gf += gf; row.ga += ga;
      row[r.toLowerCase()]++;
      if (ga === 0) row.cs++;
      if (gf === 0) row.blanks++;
      row.lossRun = r === "L" ? row.lossRun + 1 : 0;
      row.worstRun = Math.max(row.worstRun, row.lossRun);
      row.elo += m.home_team_id === id ? history[i].deltaHome : history[i].deltaAway;
      row.run = r === "W" ? row.run + 1 : 0;
      row.bestRun = Math.max(row.bestRun, row.run);
      rows.set(id, row);
    }
  }
  return [...rows.values()].map(r => ({ ...r, winPct: r.w / r.gp, gd: r.gf - r.ga }));
}

// ---------- awards ----------
// Returns [{ key, label, teamId, value, detail, other }]. Only awards someone qualifies for.
//   eligible: Set of player ids allowed to win the per-player awards (null = everyone)
//   improvedLabel: wording for the Elo-gain award
export function computeAwards(entries, history, { eligible = null, improvedLabel = "this season" } = {}) {
  const awards = [];
  const rows = playerTable(entries, history).filter(r => !eligible || eligible.has(r.id));
  const by = (fn, filter = () => true) => rows.filter(filter).sort(fn)[0];

  const wins = by((a, b) => b.w - a.w || a.gp - b.gp, r => r.w > 0);
  if (wins) awards.push({ key: "wins", label: "Most wins", teamId: wins.id,
    value: `${wins.w} wins`, detail: `from ${wins.gp} games` });

  const boot = by((a, b) => b.gf - a.gf || a.gp - b.gp, r => r.gf > 0);
  if (boot) awards.push({ key: "boot", label: "Golden boot", teamId: boot.id,
    value: `${boot.gf} goals`, detail: `in ${boot.gp} games` });

  // need a fair share of games to qualify for per-game awards
  const maxGp = Math.max(0, ...rows.map(r => r.gp));
  const minGp = Math.max(2, Math.ceil(maxGp / 2));
  const wall = by((a, b) => a.ga / a.gp - b.ga / b.gp || b.gp - a.gp, r => r.gp >= minGp);
  if (wall) awards.push({ key: "wall", label: "Best defense", teamId: wall.id,
    value: `${(wall.ga / wall.gp).toFixed(1)} conceded`, detail: `per game · ${wall.gp} games` });

  const sharp = by((a, b) => b.winPct - a.winPct || b.gp - a.gp, r => r.gp >= minGp && r.w > 0);
  if (sharp) awards.push({ key: "pct", label: "Best win rate", teamId: sharp.id,
    value: `${Math.round(sharp.winPct * 100)}%`, detail: `${sharp.w}-${sharp.d}-${sharp.l}` });

  // biggest win and biggest upset come from single games
  let big = null, upset = null;
  for (const [m, i] of entries) {
    if (m.home_goals === m.away_goals) continue;
    const homeWon = m.home_goals > m.away_goals;
    const w = homeWon ? m.home_team_id : m.away_team_id;
    const l = homeWon ? m.away_team_id : m.home_team_id;
    if (eligible && !eligible.has(w)) continue;
    const margin = Math.abs(m.home_goals - m.away_goals);
    if (!big || margin > big.margin) big = { m, margin, w, l };
    const chance = homeWon ? history[i].homeExpected : 1 - history[i].homeExpected;
    if (chance < 0.4 && (!upset || chance < upset.chance)) upset = { chance, w, l };
  }
  if (big) awards.push({ key: "big", label: "Biggest win", teamId: big.w, other: big.l,
    value: `${Math.max(big.m.home_goals, big.m.away_goals)}–${Math.min(big.m.home_goals, big.m.away_goals)}`, detail: "vs" });
  if (upset) awards.push({ key: "upset", label: "Biggest upset", teamId: upset.w, other: upset.l,
    value: `${Math.round(upset.chance * 100)}% chance`, detail: "beat" });

  const hot = by((a, b) => b.bestRun - a.bestRun, r => r.bestRun >= 2);
  if (hot) awards.push({ key: "streak", label: "Longest win streak", teamId: hot.id,
    value: `${hot.bestRun} wins`, detail: "in a row" });

  const up = by((a, b) => b.elo - a.elo, r => r.elo >= 1);
  if (up) awards.push({ key: "improved", label: "Most Elo gained", teamId: up.id,
    value: `+${Math.round(up.elo)} Elo`, detail: improvedLabel });

  const busy = by((a, b) => b.gp - a.gp, r => r.gp > 0);
  if (busy && rows.length > 1) awards.push({ key: "active", label: "Most games", teamId: busy.id,
    value: `${busy.gp} games`, detail: "" });

  return awards;
}

// ---------- hall of shame ----------
// The not-so-good stats. Same inputs as computeAwards.
export function computeShame(entries, history, { eligible = null } = {}) {
  const out = [];
  const rows = playerTable(entries, history).filter(r => !eligible || eligible.has(r.id));
  const by = (fn, filter = () => true) => rows.filter(filter).sort(fn)[0];
  const maxGp = Math.max(0, ...rows.map(r => r.gp));
  const minGp = Math.max(2, Math.ceil(maxGp / 2));

  const losses = by((a, b) => b.l - a.l || b.gp - a.gp, r => r.l > 0);
  if (losses) out.push({ key: "spoon", label: "Most losses", teamId: losses.id,
    value: `${losses.l} losses`, detail: `from ${losses.gp} games` });

  const leaky = by((a, b) => b.ga / b.gp - a.ga / a.gp, r => r.gp >= minGp && r.ga > 0);
  if (leaky) out.push({ key: "leaky", label: "Leakiest defense", teamId: leaky.id,
    value: `${(leaky.ga / leaky.gp).toFixed(1)} conceded`, detail: `per game · ${leaky.ga} total` });

  const cold = by((a, b) => b.worstRun - a.worstRun, r => r.worstRun >= 2);
  if (cold) out.push({ key: "cold", label: "Longest losing streak", teamId: cold.id,
    value: `${cold.worstRun} losses`, detail: "in a row" });

  const blank = by((a, b) => b.blanks - a.blanks || a.gp - b.gp, r => r.blanks >= 2);
  if (blank) out.push({ key: "blank", label: "Shooting blanks", teamId: blank.id,
    value: `${blank.blanks} games`, detail: "without scoring" });

  const drop = by((a, b) => a.elo - b.elo, r => r.elo <= -1);
  if (drop) out.push({ key: "drop", label: "Biggest Elo drop", teamId: drop.id,
    value: `${Math.round(drop.elo)} Elo`, detail: "" });

  // single-game shame: heaviest defeat and biggest choke (favorite who lost)
  let heavy = null, choke = null;
  for (const [m, i] of entries) {
    if (m.home_goals === m.away_goals) continue;
    const homeWon = m.home_goals > m.away_goals;
    const w = homeWon ? m.home_team_id : m.away_team_id;
    const l = homeWon ? m.away_team_id : m.home_team_id;
    if (eligible && !eligible.has(l)) continue;
    const margin = Math.abs(m.home_goals - m.away_goals);
    if (!heavy || margin > heavy.margin) heavy = { m, margin, w, l };
    const loserChance = homeWon ? 1 - history[i].homeExpected : history[i].homeExpected;
    if (loserChance > 0.6 && (!choke || loserChance > choke.chance)) choke = { chance: loserChance, w, l };
  }
  if (heavy) out.push({ key: "heavy", label: "Heaviest defeat", teamId: heavy.l, other: heavy.w,
    value: `${Math.min(heavy.m.home_goals, heavy.m.away_goals)}–${Math.max(heavy.m.home_goals, heavy.m.away_goals)}`, detail: "vs" });
  if (choke) out.push({ key: "choke", label: "Biggest choke", teamId: choke.l, other: choke.w,
    value: `${Math.round(choke.chance * 100)}% favorite`, detail: "lost to" });

  return out;
}

// ---------- fun stats ----------
export function computeFun(entries, history, { eligible = null } = {}) {
  const out = [];
  const rows = playerTable(entries, history).filter(r => !eligible || eligible.has(r.id));

  // highest-scoring game
  let fest = null;
  for (const [m] of entries) {
    const total = m.home_goals + m.away_goals;
    if (!fest || total > fest.total) fest = { m, total };
  }
  if (fest?.total) out.push({ key: "fest", label: "Goal fest", teamId: fest.m.home_team_id, other: fest.m.away_team_id,
    value: `${fest.m.home_goals}–${fest.m.away_goals}`, detail: `${fest.total} goals in one game` });

  const draws = rows.filter(r => r.d >= 2).sort((a, b) => b.d - a.d || a.gp - b.gp)[0];
  if (draws) out.push({ key: "draws", label: "Draw specialist", teamId: draws.id,
    value: `${draws.d} draws`, detail: `from ${draws.gp} games` });

  const cs = rows.filter(r => r.cs >= 2).sort((a, b) => b.cs - a.cs)[0];
  if (cs) out.push({ key: "cs", label: "Most clean sheets", teamId: cs.id,
    value: `${cs.cs} clean sheets`, detail: "" });

  // bogey team: most losses to one opponent without ever beating them
  const vs = new Map();
  for (const [m] of entries) {
    for (const id of [m.home_team_id, m.away_team_id]) {
      const opp = id === m.home_team_id ? m.away_team_id : m.home_team_id;
      const { r } = resultFor(m, id);
      const k = `${id}-${opp}`;
      const v = vs.get(k) ?? { id, opp, w: 0, l: 0, d: 0 };
      v[r.toLowerCase()]++;
      vs.set(k, v);
    }
  }
  const bogey = [...vs.values()]
    .filter(v => v.w === 0 && v.l >= 2 && (!eligible || eligible.has(v.id)))
    .sort((a, b) => b.l - a.l || a.d - b.d)[0];
  if (bogey) out.push({ key: "bogey", label: "Bogey team", teamId: bogey.id, other: bogey.opp,
    value: `0-${bogey.d}-${bogey.l}`, detail: "never beaten" });

  // most one-sided scoring: most goals per game
  const maxGp = Math.max(0, ...rows.map(r => r.gp));
  const minGp = Math.max(2, Math.ceil(maxGp / 2));
  const attack = rows.filter(r => r.gp >= minGp).sort((a, b) => b.gf / b.gp - a.gf / a.gp)[0];
  if (attack) out.push({ key: "attack", label: "Most goals per game", teamId: attack.id,
    value: `${(attack.gf / attack.gp).toFixed(1)} goals`, detail: `per game · ${attack.gp} games` });

  return out;
}

// Best guest: highest current Elo among non-league players who've played.
export function bestGuest(ratings, guestIds, playedIds) {
  const g = [...guestIds].filter(id => playedIds.has(id))
    .sort((a, b) => (ratings.get(b) ?? 0) - (ratings.get(a) ?? 0))[0];
  return g == null ? null : { key: "guest", label: "Best guest", teamId: g,
    value: `${Math.round(ratings.get(g))} Elo`, detail: "" };
}

// ---------- clubs ----------
// One row per club (grouped case-insensitively) across the given matches.
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
