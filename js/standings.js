export function computeStandings(teams, matches, points) {
  const rows = new Map(teams.map(t => [t.id, {
    team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [],
  }]));

  for (const m of matches) {
    if (m.stage !== "league") continue;
    const h = rows.get(m.home_team_id);
    const a = rows.get(m.away_team_id);
    if (!h || !a) continue;

    h.p++; a.p++;
    h.gf += m.home_goals; h.ga += m.away_goals;
    a.gf += m.away_goals; a.ga += m.home_goals;

    if (m.home_goals > m.away_goals) {
      h.w++; a.l++; h.form.push("W"); a.form.push("L");
    } else if (m.home_goals < m.away_goals) {
      a.w++; h.l++; a.form.push("W"); h.form.push("L");
    } else {
      h.d++; a.d++; h.form.push("D"); a.form.push("D");
    }
  }

  for (const r of rows.values()) {
    r.gd = r.gf - r.ga;
    r.pts = r.w * points.win + r.d * points.draw + r.l * points.loss;
    r.form = r.form.slice(-5);
  }

  return [...rows.values()].sort((x, y) =>
    y.pts - x.pts || y.gd - x.gd || y.gf - x.gf ||
    x.team.name.localeCompare(y.team.name));
}
