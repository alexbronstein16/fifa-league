// Achievements: badges unlocked by things players do in games.
// Nothing is stored. Like Elo, they're worked out by replaying every match in order,
// so editing or deleting a result updates them automatically.
//
// Forfeits weren't really played, so they never unlock anything, except the
// "No-show" badge for the player who forfeited.

import { computeStandings } from "./standings.js";
import { buildBracket, winnerOf } from "./bracket.js";

// group: milestone | feat | run | elo | season | shame
export const ACHIEVEMENTS = [
  { key: "first_win", group: "milestone", icon: "🎉", name: "First win", desc: "Win a game" },
  { key: "first_cs", group: "milestone", icon: "🧤", name: "First clean sheet", desc: "Keep a clean sheet" },
  { key: "gp10", group: "milestone", icon: "🎮", name: "Regular", desc: "Play 10 games" },
  { key: "gp25", group: "milestone", icon: "🕹️", name: "Veteran", desc: "Play 25 games" },
  { key: "gp50", group: "milestone", icon: "🏟️", name: "Lifer", desc: "Play 50 games" },
  { key: "gp100", group: "milestone", icon: "💯", name: "Centurion", desc: "Play 100 games" },
  { key: "goals50", group: "milestone", icon: "⚽", name: "Half century", desc: "Score 50 career goals" },
  { key: "goals100", group: "milestone", icon: "🚀", name: "Century", desc: "Score 100 career goals" },
  { key: "full_set", group: "milestone", icon: "🧩", name: "Full set", desc: "Beat every other league player at least once" },
  { key: "social", group: "milestone", icon: "🦋", name: "Social butterfly", desc: "Play 10 different opponents" },
  { key: "rivals", group: "milestone", icon: "🤼", name: "Old rivals", desc: "Play the same opponent 10 times" },
  { key: "marathon", group: "milestone", icon: "🏃", name: "Marathon", desc: "Play 5 games in one day" },

  { key: "hat", group: "feat", icon: "🎩", name: "Hat-trick", desc: "Score 3 or more in a game" },
  { key: "manita", group: "feat", icon: "🖐️", name: "Manita", desc: "Win by 5 or more" },
  { key: "giant", group: "feat", icon: "🗡️", name: "Giant slayer", desc: "Win with under a 25% chance" },
  { key: "leader", group: "feat", icon: "🔒", name: "Locked the leader", desc: "Keep a clean sheet against whoever tops the table" },
  { key: "machine", group: "feat", icon: "🤖", name: "Goal machine", desc: "Score 5 or more in a game" },
  { key: "pens", group: "feat", icon: "🥅", name: "Shootout hero", desc: "Win a playoff game on penalties" },
  { key: "spoil", group: "feat", icon: "🧯", name: "Spoilsport", desc: "End someone's win streak of 5 or more" },
  { key: "payback", group: "feat", icon: "😤", name: "Payback", desc: "Beat the player who knocked you out of the playoffs" },

  { key: "fire", group: "run", icon: "🔥", name: "On fire", desc: "Win 5 in a row" },
  { key: "wall", group: "run", icon: "🧱", name: "Brick wall", desc: "Keep 3 clean sheets in a row" },
  { key: "month", group: "run", icon: "📅", name: "Unbeaten month", desc: "Play 4+ games in a month without losing" },
  { key: "sweep", group: "run", icon: "🧹", name: "Clean sweep", desc: "Win every game in one round of league fixtures" },
  { key: "bounce", group: "run", icon: "🪃", name: "Bounce back", desc: "Win right after losing 3 or more in a row" },
  { key: "globe", group: "run", icon: "🌍", name: "Globetrotter", desc: "Win with 5 different clubs" },
  { key: "oneclub", group: "run", icon: "🧣", name: "One-club man", desc: "Play 20 games with the same club" },

  { key: "elo1600", group: "elo", icon: "📈", name: "1600 club", desc: "Reach 1600 Elo" },
  { key: "elo1700", group: "elo", icon: "⭐", name: "1700 club", desc: "Reach 1700 Elo" },
  { key: "elo1800", group: "elo", icon: "👑", name: "1800 club", desc: "Reach 1800 Elo" },
  { key: "no1", group: "elo", icon: "🥇", name: "Number one", desc: "Top the Elo ladder (after 5+ games)" },
  { key: "jackpot", group: "elo", icon: "💰", name: "Jackpot", desc: "Gain 25+ Elo in one game (after your first 10)" },

  { key: "champion", group: "season", icon: "🏆", name: "Champion", desc: "Win the playoffs" },
  { key: "shield", group: "season", icon: "🛡️", name: "League winner", desc: "Finish a season top of the table" },
  { key: "double", group: "season", icon: "✌️", name: "The double", desc: "Top the table and win the playoffs in the same season" },
  { key: "finalist", group: "season", icon: "🎟️", name: "Finalist", desc: "Reach a playoff final" },
  { key: "invincible", group: "season", icon: "🦁", name: "Invincible", desc: "Go a whole league season unbeaten" },
  { key: "boot", group: "season", icon: "👟", name: "Golden boot", desc: "Top scorer of a season" },
  { key: "ironman", group: "season", icon: "🦾", name: "Ever present", desc: "Play every league game of a season, no forfeits" },

  { key: "spoon", group: "shame", icon: "🥄", name: "Wooden spoon", desc: "Finish a season last" },
  { key: "thrashed", group: "shame", icon: "🫠", name: "Thrashed", desc: "Lose by 5 or more" },
  { key: "bottled", group: "shame", icon: "🍾", name: "Bottled it", desc: "Lose with a 75%+ chance of winning" },
  { key: "bogeyed", group: "shame", icon: "👻", name: "Bogeyed", desc: "Lose 3 in a row to the same player" },
  { key: "noshow", group: "shame", icon: "🚫", name: "No-show", desc: "Forfeit a game" },
  { key: "drought", group: "shame", icon: "🏜️", name: "Goal drought", desc: "Fail to score in 3 games in a row" },
  { key: "freefall", group: "shame", icon: "🪂", name: "Freefall", desc: "Lose 5 in a row" },
  { key: "heartbreak", group: "shame", icon: "💔", name: "Heartbreak", desc: "Lose a playoff final" },
];

export const BY_KEY = new Map(ACHIEVEMENTS.map(a => [a.key, a]));
export const GROUP_NAMES = { milestone: "Milestones", feat: "Big games", run: "Runs", elo: "Elo", season: "Seasons", shame: "Shame" };

const monthKey = iso => iso.slice(0, 7);  // "2026-10"

// Returns:
//   byPlayer: Map(id -> Map(key -> { date, matchId, opp, season, count }))
//             date/opp are from the first time it was unlocked; count is how many times
//   events:   every unlock, newest first: { id, key, date, matchId, opp, season }
//   rarity:   Map(key -> number of players who have it)
//   players:  ids of everyone who's played a real game (the rarity denominator)
export function computeAchievements(teams, matches, history, league, now = new Date()) {
  const leagueIds = new Set(teams.filter(t => t.in_league).map(t => t.id));
  const byPlayer = new Map();
  const events = [];
  const award = (id, key, info) => {
    const mine = byPlayer.get(id) ?? new Map();
    byPlayer.set(id, mine);
    const cur = mine.get(key);
    if (cur) cur.count++;
    else mine.set(key, { ...info, count: 1 });
    events.push({ id, key, ...info });
  };
  const once = (id, key, info) => { if (!byPlayer.get(id)?.has(key)) award(id, key, info); };

  // per-player running state
  const st = new Map();
  const state = id => {
    let s = st.get(id);
    if (!s) {
      s = { gp: 0, goals: 0, winRun: 0, csRun: 0, lossRun: 0, blankRun: 0, beaten: new Set(), lossRunVs: new Map(),
            months: new Map(), vs: new Map(), days: new Map(), clubs: new Map(), winClubs: new Set(), knockedOutBy: null };
      st.set(id, s);
    }
    return s;
  };
  const rating = new Map();

  // league players per season, and per-season running tables (for "Locked the leader")
  const seasonPlayers = new Map();
  for (const m of matches) {
    if (m.stage !== "league") continue;
    const set = seasonPlayers.get(m.season) ?? new Set();
    set.add(m.home_team_id); set.add(m.away_team_id);
    seasonPlayers.set(m.season, set);
  }
  const tables = new Map();   // season -> Map(id -> { p, pts, gd, gf })
  const legGames = new Map(); // `${season}:${id}` -> Map(opp -> results[])

  matches.forEach((m, i) => {
    const h = m.home_team_id, a = m.away_team_id;
    const entry = history[i];
    const base = { date: m.played_at, matchId: m.id, season: m.season };

    // table leader before this game (league and playoff games only)
    let leader = null;
    const table = tables.get(m.season);
    if (m.stage !== "friendly" && table) {
      const rows = [...table].filter(([, r]) => r.p >= 3)
        .sort((x, y) => y[1].pts - x[1].pts || y[1].gd - x[1].gd || y[1].gf - x[1].gf);
      leader = rows[0]?.[0] ?? null;
    }

    // before this game: each side's win streak, and who won if it's a playoff game
    const preRun = new Map([[h, st.get(h)?.winRun ?? 0], [a, st.get(a)?.winRun ?? 0]]);
    const koWinner = m.stage === "playoff" && !m.forfeit ? winnerOf(m) : null;

    for (const [id, opp, gf, ga, home] of [[h, a, m.home_goals, m.away_goals, true], [a, h, m.away_goals, m.home_goals, false]]) {
      const r = gf > ga ? "W" : gf < ga ? "L" : "D";
      const info = { ...base, opp };

      // league legs count forfeits too, so the rounds line up
      if (m.stage === "league") {
        const k = `${m.season}:${id}`;
        const legs = legGames.get(k) ?? new Map();
        legGames.set(k, legs);
        const vs = legs.get(opp) ?? [];
        vs.push(m.forfeit ? "F" : r);
        legs.set(opp, vs);
        const leg = vs.length - 1;
        const others = (seasonPlayers.get(m.season)?.size ?? 0) - 1;
        const done = [...legs.values()].filter(v => v.length > leg);
        if (others >= 2 && done.length === others && done.every(v => v[leg] === "W")) award(id, "sweep", info);
      }

      if (m.forfeit) {
        if (r === "L") award(id, "noshow", info);
        continue;
      }

      const s = state(id);
      const chance = home ? entry.homeExpected : 1 - entry.homeExpected;
      const delta = home ? entry.deltaHome : entry.deltaAway;
      const pastProvisional = s.gp >= (league.elo.provisionalGames ?? 0);
      s.gp++;
      s.goals += gf;

      if (r === "W") once(id, "first_win", info);
      if (ga === 0) once(id, "first_cs", info);
      for (const n of [10, 25, 50, 100]) if (s.gp === n) once(id, `gp${n}`, info);
      for (const n of [50, 100]) if (s.goals >= n) once(id, `goals${n}`, info);

      if (gf >= 3) award(id, "hat", info);
      if (gf - ga >= 5) award(id, "manita", info);
      if (r === "W" && chance < 0.25) award(id, "giant", info);
      if (ga === 0 && leader === opp) award(id, "leader", info);
      if (gf >= 5) award(id, "machine", info);
      if (koWinner === id && gf === ga) award(id, "pens", info);
      if (r === "W" && preRun.get(opp) >= 5) award(id, "spoil", info);
      if (r === "W" && s.knockedOutBy === opp) { award(id, "payback", info); s.knockedOutBy = null; }
      if (koWinner === opp) s.knockedOutBy = opp;
      if (r === "W" && s.lossRun >= 3) award(id, "bounce", info);
      s.lossRun = r === "L" ? s.lossRun + 1 : 0;
      if (s.lossRun === 5) award(id, "freefall", info);
      s.blankRun = gf === 0 ? s.blankRun + 1 : 0;
      if (s.blankRun === 3) award(id, "drought", info);

      // opponents, days and clubs
      const vsN = (s.vs.get(opp) ?? 0) + 1;
      s.vs.set(opp, vsN);
      if (vsN === 10) award(id, "rivals", info);
      if (s.vs.size === 10 && vsN === 1) once(id, "social", info);
      const dayKey = m.played_at.slice(0, 10);
      const dayN = (s.days.get(dayKey) ?? 0) + 1;
      s.days.set(dayKey, dayN);
      if (dayN === 5) award(id, "marathon", info);
      const club = (home ? m.home_club : m.away_club)?.trim().toLowerCase();
      if (club) {
        const n = (s.clubs.get(club) ?? 0) + 1;
        s.clubs.set(club, n);
        if (n === 20) award(id, "oneclub", info);
        if (r === "W") { s.winClubs.add(club); if (s.winClubs.size === 5) once(id, "globe", info); }
      }

      s.winRun = r === "W" ? s.winRun + 1 : 0;
      if (s.winRun === 5) award(id, "fire", info);
      s.csRun = ga === 0 ? s.csRun + 1 : 0;
      if (s.csRun === 3) award(id, "wall", info);

      const mon = s.months.get(monthKey(m.played_at)) ?? { gp: 0, l: 0, last: null };
      mon.gp++; if (r === "L") mon.l++; mon.last = { ...base, opp: null };
      s.months.set(monthKey(m.played_at), mon);

      if (pastProvisional && delta >= 25) award(id, "jackpot", info);

      // shame
      if (ga - gf >= 5) award(id, "thrashed", info);
      if (r === "L" && chance > 0.75) award(id, "bottled", info);
      const run = r === "L" ? (s.lossRunVs.get(opp) ?? 0) + 1 : 0;
      s.lossRunVs.set(opp, run);
      if (run === 3) award(id, "bogeyed", info);

      if (r === "W") {
        s.beaten.add(opp);
        const others = [...leagueIds].filter(x => x !== id);
        if (leagueIds.has(id) && others.length >= 3 && others.every(x => s.beaten.has(x))) once(id, "full_set", info);
      }
    }

    // Elo after the game (forfeits move Elo too)
    rating.set(h, entry[h]);
    rating.set(a, entry[a]);
    if (!m.forfeit) {
      for (const [id, opp] of [[h, a], [a, h]]) {
        const info = { ...base, opp };
        for (const n of [1600, 1700, 1800]) if (rating.get(id) >= n) once(id, `elo${n}`, info);
        const top = Math.max(...[...rating].filter(([x]) => st.has(x)).map(([, v]) => v));
        if (state(id).gp >= 5 && rating.get(id) >= top) once(id, "no1", info);
      }
    }

    // update the season table after the game
    if (m.stage === "league") {
      const t = tables.get(m.season) ?? new Map();
      tables.set(m.season, t);
      for (const [id, gf, ga] of [[h, m.home_goals, m.away_goals], [a, m.away_goals, m.home_goals]]) {
        const row = t.get(id) ?? { p: 0, pts: 0, gd: 0, gf: 0 };
        row.p++; row.gd += gf - ga; row.gf += gf;
        row.pts += gf > ga ? league.points.win : gf === ga ? league.points.draw : league.points.loss;
        t.set(id, row);
      }
    }
  });

  // unbeaten months: only once the month is over
  const thisMonth = monthKey(now.toISOString());
  for (const [id, s] of st) {
    for (const [mk, mon] of [...s.months].sort()) {
      if (mk < thisMonth && mon.gp >= 4 && mon.l === 0) award(id, "month", mon.last);
    }
  }

  // season badges: only for seasons whose playoffs have finished
  const teamById = new Map(teams.map(t => [t.id, t]));
  for (const [season, ids] of seasonPlayers) {
    const games = matches.filter(m => m.season === season && m.stage !== "friendly");
    const seasonTeams = [...ids].map(id => teamById.get(id)).filter(Boolean);
    const standings = computeStandings(seasonTeams, games, league.points);
    const bracket = buildBracket(standings, games, league.playoffSpots);
    if (!bracket.champion) continue;
    const end = games.at(-1);
    const info = { date: end.played_at, matchId: end.id, season, opp: null };

    award(bracket.champion, "champion", info);
    if (standings.length > 1) award(standings.at(-1).team.id, "spoon", info);
    const top = standings[0].team.id;
    award(top, "shield", info);
    if (top === bracket.champion) award(top, "double", info);
    const final = bracket.rounds.at(-1).ties[0];
    for (const id of [final.a, final.b]) if (id != null) award(id, "finalist", info);
    const loser = final.a === bracket.champion ? final.b : final.a;
    if (loser != null) award(loser, "heartbreak", info);

    const goals = new Map();
    for (const m of games) {
      if (m.forfeit) continue;
      goals.set(m.home_team_id, (goals.get(m.home_team_id) ?? 0) + m.home_goals);
      goals.set(m.away_team_id, (goals.get(m.away_team_id) ?? 0) + m.away_goals);
    }
    const most = Math.max(...goals.values());
    for (const [id, g] of goals) if (g === most && g > 0) award(id, "boot", info);

    const scheduled = (ids.size - 1) * (league.legs ?? 1);
    for (const id of ids) {
      const mine = games.filter(m => m.stage === "league" && (m.home_team_id === id || m.away_team_id === id));
      const forfeited = mine.some(m => m.forfeit && (m.home_team_id === id ? m.home_goals < m.away_goals : m.away_goals < m.home_goals));
      if (mine.length >= scheduled && !forfeited) award(id, "ironman", info);
      const lost = mine.some(m => (m.home_team_id === id ? m.home_goals < m.away_goals : m.away_goals < m.home_goals));
      if (mine.length >= scheduled && !lost) award(id, "invincible", info);
    }
  }

  const rarity = new Map();
  for (const mine of byPlayer.values()) for (const k of mine.keys()) rarity.set(k, (rarity.get(k) ?? 0) + 1);
  events.sort((x, y) => y.date.localeCompare(x.date));
  return { byPlayer, events, rarity, players: new Set(st.keys()) };
}
