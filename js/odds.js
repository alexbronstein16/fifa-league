// Playoff odds: plays out the rest of the season thousands of times and counts
// how often each player makes the playoffs, gets a bye, reaches the final and wins it.
//
// How one simulated game works:
//   - Each player's chance comes from their current Elo (the same number the site
//     shows as a win chance). Ratings don't change during a simulated season.
//   - Goals are drawn from a Poisson distribution, the standard model for football
//     scores, tuned so the stronger player wins exactly as often as Elo says
//     (counting a draw as half a win). This gives realistic draws and goal
//     differences, which matter for tiebreakers.
//   - Scoring level matches this league: the average goals per player per game so far.
//   - Playoff games that end level go to a 50/50 shootout.
// Games already played count as they are, including real playoff results.

import { expected } from "./elo.js";
import { buildBracket } from "./bracket.js";

const MAX_GOALS = 15;

// Same seed for the same results, so the numbers don't wobble on every refresh.
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pmf = lambda => {
  const p = [Math.exp(-lambda)];
  for (let k = 1; k <= MAX_GOALS; k++) p.push(p[k - 1] * lambda / k);
  return p;
};

// P(a wins) + P(draw) / 2 when a scores ~Poisson(la) and b ~Poisson(lb)
function score(la, lb) {
  const pa = pmf(la), pb = pmf(lb);
  let win = 0, draw = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      if (i > j) win += pa[i] * pb[j];
      else if (i === j) draw += pa[i] * pb[j];
    }
  }
  return win + draw / 2;
}

// Goal rates for two players: their average is `mu` goals each, and the split
// between them is set so the result matches the Elo chance `e`.
function rates(e, mu) {
  let lo = -4, hi = 4;  // log of how many times more the first player scores
  for (let it = 0; it < 40; it++) {
    const mid = (lo + hi) / 2;
    if (score(mu * Math.exp(mid / 2), mu * Math.exp(-mid / 2)) < e) lo = mid; else hi = mid;
  }
  const r = (lo + hi) / 2;
  return [mu * Math.exp(r / 2), mu * Math.exp(-r / 2)];
}

function poisson(lambda, rand) {
  const l = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > l);
  return k - 1;
}

// League games still to play: every pair of league players meets `legs` times.
export function remainingFixtures(ids, seasonMatches, legs) {
  const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const played = new Map();
  for (const m of seasonMatches) {
    if (m.stage !== "league") continue;
    const k = key(m.home_team_id, m.away_team_id);
    played.set(k, (played.get(k) ?? 0) + 1);
  }
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const left = legs - (played.get(key(ids[i], ids[j])) ?? 0);
      for (let n = 0; n < left; n++) out.push([ids[i], ids[j]]);
    }
  }
  return out;
}

// teams: league players.  seasonMatches: this season's league + playoff games.
// ratings: current Elo (Map).  Returns one row per player, best title chance first.
export function playoffOdds(teams, seasonMatches, ratings, league, { sims = 5000 } = {}) {
  const ids = teams.map(t => t.id);
  const ix = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  if (n < 2) return null;
  const elo = id => ratings.get(id) ?? league.elo.start;

  // the table so far (forfeits included, like the real table)
  const base = ids.map(() => ({ pts: 0, gd: 0, gf: 0 }));
  let goals = 0, games = 0;
  for (const m of seasonMatches) {
    if (m.stage !== "league" || !ix.has(m.home_team_id) || !ix.has(m.away_team_id)) continue;
    const h = base[ix.get(m.home_team_id)], a = base[ix.get(m.away_team_id)];
    const p = league.points;
    h.gf += m.home_goals; a.gf += m.away_goals;
    h.gd += m.home_goals - m.away_goals; a.gd += m.away_goals - m.home_goals;
    h.pts += m.home_goals > m.away_goals ? p.win : m.home_goals === m.away_goals ? p.draw : p.loss;
    a.pts += m.away_goals > m.home_goals ? p.win : m.home_goals === m.away_goals ? p.draw : p.loss;
    if (!m.forfeit) { goals += m.home_goals + m.away_goals; games++; }
  }
  // average goals per player per game; until there's enough data, assume 1.5
  const mu = games >= 5 ? Math.max(0.5, goals / games / 2) : 1.5;

  const fixtures = remainingFixtures(ids, seasonMatches, league.legs ?? 2)
    .map(([a, b]) => ({ a: ix.get(a), b: ix.get(b), rates: rates(expected(elo(a), elo(b)), mu) }));
  const playoffs = seasonMatches.filter(m => m.stage === "playoff");

  // playoff ties not played yet: cache goal rates per pair
  const pairRates = new Map();
  const ko = (a, b, rand) => {
    const k = `${a}-${b}`;
    let r = pairRates.get(k);
    if (!r) pairRates.set(k, r = rates(expected(elo(a), elo(b)), mu));
    const ga = poisson(r[0], rand), gb = poisson(r[1], rand);
    if (ga !== gb) return ga > gb ? a : b;
    return rand() < 0.5 ? a : b;  // shootout
  };

  const rand = rng(seasonMatches.length * 7919 + ids.reduce((s, id) => s + id, 0));
  const spots = Math.min(league.playoffSpots, n);
  let size = 2;
  while (size < spots) size *= 2;
  const byes = size - spots;

  const count = ids.map(() => ({ playoffs: 0, bye: 0, first: 0, final: 0, champion: 0, pts: 0 }));
  const order = ids.map((_, i) => i);
  const nameOf = new Map(teams.map(t => [t.id, t.name]));

  for (let s = 0; s < sims; s++) {
    const t = base.map(r => ({ ...r }));
    for (const f of fixtures) {
      const ga = poisson(f.rates[0], rand), gb = poisson(f.rates[1], rand);
      const A = t[f.a], B = t[f.b], p = league.points;
      A.gf += ga; B.gf += gb; A.gd += ga - gb; B.gd += gb - ga;
      A.pts += ga > gb ? p.win : ga === gb ? p.draw : p.loss;
      B.pts += gb > ga ? p.win : ga === gb ? p.draw : p.loss;
    }
    // same tiebreakers as the real table: points, goal difference, goals, then name
    order.sort((x, y) => t[y].pts - t[x].pts || t[y].gd - t[x].gd || t[y].gf - t[x].gf ||
      nameOf.get(ids[x]).localeCompare(nameOf.get(ids[y])));
    const standings = order.map(i => ({ team: { id: ids[i] } }));
    order.forEach((i, pos) => {
      count[i].pts += t[i].pts;
      if (pos === 0) count[i].first++;
      if (pos < spots) count[i].playoffs++;
      if (pos < byes) count[i].bye++;
    });
    const b = buildBracket(standings, playoffs, league.playoffSpots, (a, c) => ko(a, c, rand));
    const final = b.rounds.at(-1)?.ties[0];
    if (final?.a != null) count[ix.get(final.a)].final++;
    if (final?.b != null) count[ix.get(final.b)].final++;
    if (b.champion != null) count[ix.get(b.champion)].champion++;
  }

  return {
    sims, byes, spots, remaining: fixtures.length, mu,
    rows: ids.map((id, i) => ({
      id, elo: elo(id),
      pts: base[i].pts, projPts: count[i].pts / sims,
      playoffs: count[i].playoffs / sims, bye: count[i].bye / sims, first: count[i].first / sims,
      final: count[i].final / sims, champion: count[i].champion / sims,
    })).sort((a, b) => b.champion - a.champion || b.playoffs - a.playoffs || b.projPts - a.projPts),
  };
}
