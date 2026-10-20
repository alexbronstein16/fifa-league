// League-wide stats: awards, hall of shame, fun stats, leaderboards and clubs.
// Pure functions: data in, numbers out.
//
// Most functions take `entries`: a list of [match, i] pairs, where i is the
// match's index in the full match list, so history[i] (from computeElo) gives
// that game's Elo change and pre-game odds. Pick the games you want (a season's
// league games, all friendlies, ...) and every stat is computed over just those.
//
// Every stat is ranked, not just won: each one returns a top 3, so a dominant
// player can lead a stat without hiding everyone else.

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

const chanceFor = (m, i, history, id) =>
  m.home_team_id === id ? history[i].homeExpected : 1 - history[i].homeExpected;

const one = n => n.toFixed(1);
const pct = n => `${Math.round(n * 100)}%`;
const plural = (n, word) => `${n} ${n === 1 ? word : word.endsWith("s") ? word + "es" : word + "s"}`;

// ---------- per-player totals ----------
export function playerTable(entries, history) {
  const rows = new Map();
  for (const [m, i] of entries) {
    for (const id of [m.home_team_id, m.away_team_id]) {
      const { gf, ga, r } = resultFor(m, id);
      const chance = chanceFor(m, i, history, id);
      const row = rows.get(id) ?? {
        id, gp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, blanks: 0, elo: 0,
        run: 0, bestRun: 0, lossRun: 0, worstRun: 0, unbeaten: 0, bestUnbeaten: 0, winless: 0, worstWinless: 0,
        closeGp: 0, closePts: 0, giant: 0, bottles: 0, maxGf: 0, gds: [], results: [], clubs: new Map(),
      };
      row.gp++; row.gf += gf; row.ga += ga;
      row[r.toLowerCase()]++;
      if (ga === 0) row.cs++;
      if (gf === 0) row.blanks++;
      row.elo += m.home_team_id === id ? history[i].deltaHome : history[i].deltaAway;

      row.run = r === "W" ? row.run + 1 : 0;
      row.bestRun = Math.max(row.bestRun, row.run);
      row.lossRun = r === "L" ? row.lossRun + 1 : 0;
      row.worstRun = Math.max(row.worstRun, row.lossRun);
      row.unbeaten = r !== "L" ? row.unbeaten + 1 : 0;
      row.bestUnbeaten = Math.max(row.bestUnbeaten, row.unbeaten);
      row.winless = r !== "W" ? row.winless + 1 : 0;
      row.worstWinless = Math.max(row.worstWinless, row.winless);

      if (Math.abs(gf - ga) <= 1) { row.closeGp++; row.closePts += r === "W" ? 3 : r === "D" ? 1 : 0; }
      if (r === "W" && chance < 0.4) row.giant++;
      if (r === "L" && chance > 0.6) row.bottles++;
      row.maxGf = Math.max(row.maxGf, gf);
      row.gds.push(gf - ga);
      row.results.push(r);
      const club = (m.home_team_id === id ? m.home_club : m.away_club)?.trim();
      if (club) row.clubs.set(club.toLowerCase(), (row.clubs.get(club.toLowerCase()) ?? 0) + 1);
      rows.set(id, row);
    }
  }
  return [...rows.values()].map(r => {
    const mean = r.gds.reduce((a, b) => a + b, 0) / r.gp;
    const sd = Math.sqrt(r.gds.reduce((a, b) => a + (b - mean) ** 2, 0) / r.gp);
    const last5 = r.results.slice(-5);
    const withClub = [...r.clubs.values()].reduce((a, b) => a + b, 0);
    return {
      ...r,
      winPct: r.w / r.gp, gd: r.gf - r.ga, gdPer: mean, sd,
      formPts: last5.reduce((a, x) => a + (x === "W" ? 3 : x === "D" ? 1 : 0), 0), formN: last5.length,
      goalsPer: (r.gf + r.ga) / r.gp,
      clubCount: r.clubs.size, withClub, loyalty: withClub ? Math.max(...r.clubs.values()) / withClub : 0,
    };
  });
}

// ---------- stat definitions ----------
// Per-player stats: rank every player by `score` (higher = better place).
//   need(r, ctx) decides who qualifies; show(r) is the headline, detail(r) the small text.
const PLAYER_STATS = [
  // awards
  { group: "award", key: "wins", icon: "✅", label: "Most wins",
    need: r => r.w > 0, score: r => r.w * 1000 - r.gp, show: r => plural(r.w, "win"), detail: r => `from ${r.gp} games` },
  { group: "award", key: "boot", icon: "⚽", label: "Golden boot",
    need: r => r.gf > 0, score: r => r.gf * 1000 - r.gp, show: r => plural(r.gf, "goal"), detail: r => `in ${r.gp} games` },
  { group: "award", key: "wall", icon: "🧤", label: "Best defense",
    need: (r, c) => r.gp >= c.fair, score: r => -r.ga / r.gp, show: r => `${one(r.ga / r.gp)} conceded`, detail: () => "per game" },
  { group: "award", key: "pct", icon: "🎯", label: "Best win rate",
    need: (r, c) => r.gp >= c.fair && r.w > 0, score: r => r.winPct + r.gp / 1e4, show: r => pct(r.winPct), detail: r => `${r.w}-${r.d}-${r.l}` },
  { group: "award", key: "gdper", icon: "📊", label: "Best goal difference",
    need: (r, c) => r.gp >= c.fair, score: r => r.gdPer, show: r => `${r.gdPer > 0 ? "+" : ""}${one(r.gdPer)}`, detail: () => "per game" },
  { group: "award", key: "cs", icon: "🧱", label: "Most clean sheets",
    need: r => r.cs > 0, score: r => r.cs * 1000 - r.gp, show: r => plural(r.cs, "clean sheet"), detail: r => `in ${r.gp} games` },
  { group: "award", key: "streak", icon: "🔥", label: "Longest win streak",
    need: r => r.bestRun >= 2, score: r => r.bestRun, show: r => `${r.bestRun} wins`, detail: () => "in a row" },
  { group: "award", key: "unbeaten", icon: "🛡️", label: "Longest unbeaten run",
    need: r => r.bestUnbeaten >= 3, score: r => r.bestUnbeaten, show: r => `${r.bestUnbeaten} games`, detail: () => "without losing" },
  { group: "award", key: "clutch", icon: "🧊", label: "Ice in the veins",
    need: r => r.closeGp >= 3, score: r => r.closePts / r.closeGp + r.closeGp / 1e4,
    show: r => `${one(r.closePts / r.closeGp)} pts`, detail: r => `per close game (${r.closeGp} decided by 1 goal or less)` },
  { group: "award", key: "giant", icon: "🗡️", label: "Giant killer",
    need: r => r.giant > 0, score: r => r.giant * 1000 - r.gp, show: r => plural(r.giant, "upset win"), detail: () => "as the underdog" },
  { group: "award", key: "form", icon: "🌡️", label: "In form",
    need: r => r.formN >= 5 && r.formPts >= 8, score: r => r.formPts * 100 + r.gdPer, show: r => `${r.formPts} of 15 pts`, detail: () => "in the last 5 games" },
  { group: "award", key: "improved", icon: "📈", label: "Most Elo gained",
    need: r => r.elo >= 1, score: r => r.elo, show: r => `+${Math.round(r.elo)} Elo`, detail: (r, c) => c.eloLabel },

  // hall of shame
  { group: "shame", key: "spoon", icon: "🥄", label: "Most losses",
    need: r => r.l > 0, score: r => r.l * 1000 + r.gp, show: r => plural(r.l, "loss"), detail: r => `from ${r.gp} games` },
  { group: "shame", key: "leaky", icon: "🕳️", label: "Leakiest defense",
    need: (r, c) => r.gp >= c.fair && r.ga > 0, score: r => r.ga / r.gp, show: r => `${one(r.ga / r.gp)} conceded`, detail: r => `per game · ${r.ga} total` },
  { group: "shame", key: "cold", icon: "🥶", label: "Longest losing streak",
    need: r => r.worstRun >= 2, score: r => r.worstRun, show: r => `${r.worstRun} losses`, detail: () => "in a row" },
  { group: "shame", key: "winless", icon: "🌧️", label: "Longest winless run",
    need: r => r.worstWinless >= 3, score: r => r.worstWinless, show: r => `${r.worstWinless} games`, detail: () => "without a win" },
  { group: "shame", key: "blank", icon: "😶", label: "Shooting blanks",
    need: r => r.blanks >= 2, score: r => r.blanks * 1000 - r.gp, show: r => `${r.blanks} games`, detail: () => "without scoring" },
  { group: "shame", key: "bottle", icon: "🍾", label: "Bottle job",
    need: r => r.bottles > 0, score: r => r.bottles * 1000 - r.gp, show: r => plural(r.bottles, "loss"), detail: () => "as the clear favorite" },
  { group: "shame", key: "coldform", icon: "🥀", label: "Out of form",
    need: r => r.formN >= 5 && r.formPts <= 7, score: r => -(r.formPts * 100 + r.gdPer), show: r => `${r.formPts} of 15 pts`, detail: () => "in the last 5 games" },
  { group: "shame", key: "drop", icon: "📉", label: "Biggest Elo drop",
    need: r => r.elo <= -1, score: r => -r.elo, show: r => `${Math.round(r.elo)} Elo`, detail: (r, c) => c.eloLabel },

  // fun
  { group: "fun", key: "entertainer", icon: "🍿", label: "The entertainer",
    need: (r, c) => r.gp >= c.fair && r.goalsPer > c.avgGoals, score: r => r.goalsPer, show: r => `${one(r.goalsPer)} goals`, detail: () => "per game, both teams" },
  { group: "fun", key: "snooze", icon: "😴", label: "Snoozefest",
    need: (r, c) => r.gp >= c.fair && r.goalsPer < c.avgGoals, score: r => -r.goalsPer, show: r => `${one(r.goalsPer)} goals`, detail: () => "per game, both teams" },
  { group: "fun", key: "draws", icon: "🤝", label: "Draw specialist",
    need: r => r.d >= 2, score: r => r.d * 1000 - r.gp, show: r => plural(r.d, "draw"), detail: r => `from ${r.gp} games` },
  { group: "fun", key: "reliable", icon: "📏", label: "Mr. Reliable",
    need: (r, c) => r.gp >= Math.max(4, c.fair) && r.sd < c.avgSd, score: r => -r.sd, show: r => `±${one(r.sd)} goals`, detail: () => "most consistent results" },
  { group: "fun", key: "chaos", icon: "🎲", label: "Agent of chaos",
    need: (r, c) => r.gp >= Math.max(4, c.fair) && r.sd > c.avgSd, score: r => r.sd, show: r => `±${one(r.sd)} goals`, detail: () => "least predictable results" },
  { group: "fun", key: "hopper", icon: "🔁", label: "Club hopper",
    need: r => r.clubCount >= 2, score: r => r.clubCount * 1000 - r.withClub, show: r => plural(r.clubCount, "club"), detail: () => "used" },
  { group: "fun", key: "loyal", icon: "💍", label: "Club loyalist",
    need: r => r.withClub >= 4, score: r => r.loyalty + r.withClub / 1e4, show: r => pct(r.loyalty), detail: r => `of ${r.withClub} games with one club` },
  { group: "fun", key: "active", icon: "🎮", label: "Most games",
    need: r => r.gp > 0, score: r => r.gp, show: r => plural(r.gp, "game"), detail: () => "" },
];

// Single-game stats: each player's best (or worst) game, then the top 3 players.
function gameStats(entries, history, eligible) {
  const best = { hat: new Map(), big: new Map(), upset: new Map(), heavy: new Map(), choke: new Map() };
  const keep = (map, id, cand) => {
    if (eligible && !eligible.has(id)) return;
    const cur = map.get(id);
    if (!cur || cand.score > cur.score) map.set(id, cand);
  };
  for (const [m, i] of entries) {
    for (const id of [m.home_team_id, m.away_team_id]) {
      const other = id === m.home_team_id ? m.away_team_id : m.home_team_id;
      const { gf, ga, r } = resultFor(m, id);
      const chance = chanceFor(m, i, history, id);
      if (gf >= 3) keep(best.hat, id, { teamId: id, other, score: gf * 100 + (gf - ga),
        value: `${gf} goals`, detail: `${gf}–${ga} vs` });
      if (r === "W") keep(best.big, id, { teamId: id, other, score: (gf - ga) * 100 + gf,
        value: `${gf}–${ga}`, detail: "vs" });
      if (r === "W" && chance < 0.4) keep(best.upset, id, { teamId: id, other, score: 1 - chance,
        value: `${pct(chance)} chance`, detail: "beat" });
      if (r === "L") keep(best.heavy, id, { teamId: id, other, score: (ga - gf) * 100 + ga,
        value: `${gf}–${ga}`, detail: "vs" });
      if (r === "L" && chance > 0.6) keep(best.choke, id, { teamId: id, other, score: chance,
        value: `${pct(chance)} favorite`, detail: "lost to" });
    }
  }
  const top = map => [...map.values()].sort((a, b) => b.score - a.score).slice(0, 3);
  return [
    { group: "award", key: "hat", icon: "🎩", label: "Most goals in a game", list: top(best.hat) },
    { group: "award", key: "big", icon: "💥", label: "Biggest win", list: top(best.big) },
    { group: "award", key: "upset", icon: "😱", label: "Biggest upset", list: top(best.upset) },
    { group: "shame", key: "heavy", icon: "🫠", label: "Heaviest defeat", list: top(best.heavy) },
    { group: "shame", key: "choke", icon: "🤡", label: "Biggest choke", list: top(best.choke) },
  ];
}

// Pair stats: games involving two specific players.
function pairStats(entries, eligible) {
  const pairs = new Map();
  let fests = [];
  for (const [m] of entries) {
    const [a, b] = m.home_team_id < m.away_team_id ? [m.home_team_id, m.away_team_id] : [m.away_team_id, m.home_team_id];
    const k = `${a}-${b}`;
    const p = pairs.get(k) ?? { a, b, gp: 0, aw: 0, bw: 0, d: 0 };
    p.gp++;
    const ra = resultFor(m, a).r;
    if (ra === "W") p.aw++; else if (ra === "L") p.bw++; else p.d++;
    pairs.set(k, p);
    fests.push({ teamId: m.home_team_id, other: m.away_team_id, score: m.home_goals + m.away_goals,
      value: `${m.home_goals}–${m.away_goals}`, detail: `${m.home_goals + m.away_goals} goals · vs`, pair: true });
  }
  const ok = p => !eligible || (eligible.has(p.a) && eligible.has(p.b));
  const list = [...pairs.values()].filter(ok);
  fests = fests.filter(f => !eligible || (eligible.has(f.teamId) && eligible.has(f.other)))
    .sort((x, y) => y.score - x.score).filter(f => f.score > 0).slice(0, 3);

  const rivalry = list.filter(p => p.gp >= 2)
    .sort((x, y) => y.gp - x.gp || Math.abs(x.aw - x.bw) - Math.abs(y.aw - y.bw)).slice(0, 3)
    .map(p => ({ teamId: p.a, other: p.b, value: `${p.aw}-${p.d}-${p.bw}`, detail: `${p.gp} games · vs`, pair: true }));

  // bogey team: most losses to one opponent without ever beating them
  const bogey = [];
  for (const p of list) {
    if (p.aw === 0 && p.bw >= 2) bogey.push({ teamId: p.a, other: p.b, l: p.bw, d: p.d });
    if (p.bw === 0 && p.aw >= 2) bogey.push({ teamId: p.b, other: p.a, l: p.aw, d: p.d });
  }
  const bogeys = bogey.sort((x, y) => y.l - x.l || x.d - y.d).slice(0, 3)
    .map(x => ({ teamId: x.teamId, other: x.other, value: `0-${x.d}-${x.l}`, detail: "never beat" }));

  return [
    { group: "fun", key: "fest", icon: "🎆", label: "Goal fest", list: fests },
    { group: "fun", key: "rivalry", icon: "🤼", label: "Biggest rivalry", list: rivalry },
    { group: "fun", key: "bogey", icon: "👻", label: "Bogey team", list: bogeys },
  ];
}

// All stats for a set of games. Returns [{ group, key, icon, label, list: [top 3] }]
// where each list item is { teamId, other?, value, detail, pair? }.
//   eligible: Set of player ids allowed to place (null = everyone)
//   eloLabel: wording under Elo stats ("this season", "from friendlies")
export function computeStats(entries, history, { eligible = null, eloLabel = "" } = {}) {
  const rows = playerTable(entries, history).filter(r => !eligible || eligible.has(r.id));
  const maxGp = Math.max(0, ...rows.map(r => r.gp));
  const fair = Math.max(2, Math.ceil(maxGp / 2));
  const regulars = rows.filter(r => r.gp >= fair);
  const avg = f => regulars.length ? regulars.reduce((a, r) => a + f(r), 0) / regulars.length : 0;
  // opposite stats (entertainer / snoozefest, reliable / chaos) split at the average,
  // so the same player can't show up in both
  const ctx = { fair, eloLabel, avgGoals: avg(r => r.goalsPer), avgSd: avg(r => r.sd) };
  const perPlayer = PLAYER_STATS.map(s => ({
    group: s.group, key: s.key, icon: s.icon, label: s.label,
    list: rows.filter(r => s.need(r, ctx)).sort((a, b) => s.score(b) - s.score(a)).slice(0, 3)
      .map(r => ({ teamId: r.id, value: s.show(r), detail: s.detail(r, ctx) })),
  }));
  const all = [...perPlayer, ...gameStats(entries, history, eligible), ...pairStats(entries, eligible)];
  return all.filter(s => s.list.length);
}

// Every player's best placement across the positive stats (awards and fun),
// so nobody disappears behind one dominant player.
export function superlatives(stats, playerIds) {
  const best = new Map();
  stats.filter(s => s.group !== "shame").forEach((s, order) => {
    s.list.forEach((item, rank) => {
      for (const id of item.pair ? [item.teamId, item.other] : [item.teamId]) {
        const cur = best.get(id);
        if (!cur || rank < cur.rank || (rank === cur.rank && order < cur.order)) best.set(id, { rank, order, stat: s, item });
      }
    });
  });
  return [...playerIds].map(id => ({ id, ...best.get(id) }))
    .sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9) || (a.order ?? 99) - (b.order ?? 99));
}

// Best guest: highest current Elo among non-league players who've played (top 3).
export function bestGuests(ratings, guestIds, playedIds) {
  const list = [...guestIds].filter(id => playedIds.has(id))
    .sort((a, b) => (ratings.get(b) ?? 0) - (ratings.get(a) ?? 0)).slice(0, 3)
    .map(id => ({ teamId: id, value: `${Math.round(ratings.get(id))} Elo`, detail: "" }));
  return list.length ? { group: "award", key: "guest", icon: "🌟", label: "Best guest", list } : null;
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
