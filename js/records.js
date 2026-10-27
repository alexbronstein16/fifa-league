// All-time records. Replays matches in order and keeps who holds each record,
// when it was set, and whose record it broke.
//
// A record only changes hands when it's beaten, not equalled: the first to get there keeps it.

const resultFor = (m, id) => {
  const home = m.home_team_id === id;
  const gf = home ? m.home_goals : m.away_goals;
  const ga = home ? m.away_goals : m.home_goals;
  return { gf, ga, r: gf > ga ? "W" : gf < ga ? "L" : "D", home };
};
const pct = n => `${Math.round(n * 100)}%`;
const plural = (n, word) => `${n} ${n === 1 ? word.replace(/s$/, "") : word}`;

// One record and its history. `run` lets a streak extend itself without
// counting as "breaking" its own record.
function tracker(def) {
  const list = [];  // every time the record was set, oldest first
  return {
    def,
    offer(c) {
      const top = list.at(-1);
      if (top && c.score <= top.score) return;
      if (top && c.run && top.run === c.run) list[list.length - 1] = { ...c, since: top.since ?? top.date };
      else list.push(c);
    },
    result() {
      if (!list.length) return null;
      const cur = list.at(-1);
      const prev = [...list].reverse().find(x => x.teamId !== cur.teamId) ?? (list.length > 1 ? list.at(-2) : null);
      return { ...def, ...cur, prev };
    },
  };
}

// keep(m): which games count (forfeits never do).  cfg: LEAGUE config.
export function computeRecords(matches, history, keep, cfg) {
  const T = {
    big: tracker({ key: "big", icon: "💥", label: "Biggest win" }),
    goals: tracker({ key: "goals", icon: "🎯", label: "Most goals in a game" }),
    fest: tracker({ key: "fest", icon: "🎆", label: "Highest-scoring game" }),
    upset: tracker({ key: "upset", icon: "😱", label: "Biggest upset" }),
    gain: tracker({ key: "gain", icon: "💰", label: "Biggest Elo gain in a game", note: "after a player's first 10 games" }),
    win: tracker({ key: "win", icon: "🔥", label: "Longest win streak" }),
    unbeaten: tracker({ key: "unbeaten", icon: "🛡️", label: "Longest unbeaten run" }),
    cs: tracker({ key: "cs", icon: "🧱", label: "Most clean sheets in a row" }),
    peak: tracker({ key: "peak", icon: "👑", label: "Highest Elo ever" }),
    low: tracker({ key: "low", icon: "🕳️", label: "Lowest Elo ever" }),
  };
  const runs = new Map();     // id -> { win, unbeaten, cs, ids }
  const played = new Map();
  let runSeq = 0;
  const run = id => runs.get(id) ?? runs.set(id, { win: 0, unbeaten: 0, cs: 0, winId: 0, unbId: 0, csId: 0 }).get(id);
  const season = new Map();   // `${season}:${id}` -> totals

  matches.forEach((m, i) => {
    const e = history[i];
    // Elo records cover every game, whatever the view
    for (const id of [m.home_team_id, m.away_team_id]) {
      const elo = e[id];
      const base = { teamId: id, date: m.played_at };
      T.peak.offer({ ...base, score: elo, value: `${Math.round(elo)}`, detail: "Elo" });
      T.low.offer({ ...base, score: -elo, value: `${Math.round(elo)}`, detail: "Elo" });
    }
    if (m.forfeit || !keep(m)) return;

    const total = m.home_goals + m.away_goals;
    T.fest.offer({ teamId: m.home_team_id, other: m.away_team_id, date: m.played_at, score: total,
      value: `${m.home_goals}–${m.away_goals}`, detail: `${total} goals · vs` });

    for (const id of [m.home_team_id, m.away_team_id]) {
      const opp = id === m.home_team_id ? m.away_team_id : m.home_team_id;
      const { gf, ga, r, home } = resultFor(m, id);
      const base = { teamId: id, other: opp, date: m.played_at };
      const chance = home ? e.homeExpected : 1 - e.homeExpected;
      const delta = home ? e.deltaHome : e.deltaAway;
      const n = played.get(id) ?? 0;
      played.set(id, n + 1);

      if (r === "W") T.big.offer({ ...base, score: (gf - ga) * 100 + gf, value: `${gf}–${ga}`, detail: "vs" });
      T.goals.offer({ ...base, score: gf, value: plural(gf, "goals"), detail: `${gf}–${ga} vs` });
      if (r === "W") T.upset.offer({ ...base, score: 1 - chance, value: `${pct(chance)} chance`, detail: "beat" });
      if (n >= (cfg.elo.provisionalGames ?? 0)) T.gain.offer({ ...base, score: delta, value: `+${Math.round(delta)} Elo`, detail: `${gf}–${ga} vs` });

      const s = run(id);
      if (r === "W") { if (!s.win) s.winId = ++runSeq; s.win++; } else s.win = 0;
      if (r !== "L") { if (!s.unbeaten) s.unbId = ++runSeq; s.unbeaten++; } else s.unbeaten = 0;
      if (ga === 0) { if (!s.cs) s.csId = ++runSeq; s.cs++; } else s.cs = 0;
      const r0 = { teamId: id, date: m.played_at };
      if (s.win) T.win.offer({ ...r0, run: s.winId, score: s.win, value: plural(s.win, "wins"), detail: "in a row" });
      if (s.unbeaten) T.unbeaten.offer({ ...r0, run: s.unbId, score: s.unbeaten, value: plural(s.unbeaten, "games"), detail: "unbeaten" });
      if (s.cs) T.cs.offer({ ...r0, run: s.csId, score: s.cs, value: plural(s.cs, "clean sheets"), detail: "in a row" });

      // season totals
      const k = `${m.season}:${id}`;
      const t = season.get(k) ?? { id, season: m.season, goals: 0, wins: 0, cs: 0, gp: 0 };
      t.gp++; t.goals += gf; if (r === "W") t.wins++; if (ga === 0) t.cs++;
      season.set(k, t);
    }
  });

  // is a streak record still going?
  const live = { win: "win", unbeaten: "unbeaten", cs: "cs" };
  const out = Object.values(T).map(t => t.result()).filter(Boolean);
  for (const rec of out) {
    const f = live[rec.key];
    if (f && runs.get(rec.teamId)?.[f] === rec.score) rec.ongoing = true;
  }

  // league points per season (forfeits count here, like the table)
  const points = new Map();
  for (const m of matches) {
    if (m.stage !== "league") continue;
    for (const id of [m.home_team_id, m.away_team_id]) {
      const { r } = resultFor(m, id);
      const k = `${m.season}:${id}`;
      const p = points.get(k) ?? { id, season: m.season, pts: 0, gp: 0 };
      p.gp++; p.pts += r === "W" ? cfg.points.win : r === "D" ? cfg.points.draw : cfg.points.loss;
      points.set(k, p);
    }
  }
  const best = (rows, f, def, fmt) => {
    const sorted = [...rows].filter(r => f(r) > 0).sort((a, b) => f(b) - f(a));
    if (!sorted.length) return null;
    const [top, next] = sorted;
    return { ...def, teamId: top.id, value: fmt(f(top)), detail: `Season ${top.season} · ${top.gp} games`,
      runnerUp: next ? { teamId: next.id, value: fmt(f(next)), season: next.season } : null };
  };
  const seasonal = [
    best(points.values(), r => r.pts, { key: "spts", icon: "📊", label: "Most league points in a season" }, v => `${v} pts`),
    best(season.values(), r => r.goals, { key: "sgoals", icon: "⚽", label: "Most goals in a season" }, v => `${v} goals`),
    best(season.values(), r => r.wins, { key: "swins", icon: "✅", label: "Most wins in a season" }, v => `${v} wins`),
    best(season.values(), r => r.cs, { key: "scs", icon: "🧤", label: "Most clean sheets in a season" }, v => `${v} clean sheets`),
  ].filter(Boolean);

  const group = keys => out.filter(r => keys.includes(r.key));
  return {
    games: group(["big", "goals", "fest", "upset", "gain"]),
    streaks: group(["win", "unbeaten", "cs"]),
    elo: group(["peak", "low"]),
    seasons: seasonal,
  };
}
