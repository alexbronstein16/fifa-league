export const esc = s => String(s ?? "").replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Team crest if there is one, otherwise their color dot.
export const badge = t => t?.crest_url
  ? `<img class="crest" src="${esc(t.crest_url)}" alt="">`
  : `<span class="dot" style="background:${esc(t?.color)}"></span>`;

// A player's name as a link to their page.
export const playerLink = t => t
  ? `<a class="plink" href="player.html?id=${t.id}">${esc(t.name)}</a>`
  : "TBD";

// Tidy a typed club name: trim, collapse spaces, empty becomes null.
export const cleanClub = s => (s ?? "").trim().replace(/\s+/g, " ") || null;

// Club names for the picker: clubs already used (most-used first),
// then the starter list. Grouped case-insensitively.
export function clubNames(matches, suggestions = []) {
  const counts = new Map();
  const add = (club, n) => {
    const c = cleanClub(club);
    if (!c) return;
    const key = c.toLowerCase();
    const entry = counts.get(key) ?? { name: c, n: 0 };
    entry.n += n;
    counts.set(key, entry);
  };
  for (const m of matches) { add(m.home_club, 1); add(m.away_club, 1); }
  for (const s of suggestions) add(s, 0);
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .map(c => c.name);
}

// Round crest for match rows: the image, or a colored circle with the team's initial.
export const crestIcon = t => t?.crest_url
  ? `<img class="ci" src="${esc(t.crest_url)}" alt="">`
  : `<span class="ci ci-fallback" style="background:${esc(t?.color ?? "#555")}">${esc((t?.short_name || t?.name || "?")[0])}</span>`;

export const shortDate = iso => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// One FotMob-style match row. `team` looks up a team object by id.
// Pass a match from the database, or { home_team_id, away_team_id } with no
// goals for a game still to be played.
//   right:  replaces the date column (e.g. "×2" for games still to play)
//   status: replaces the FT pill (e.g. a W/D/L badge on a player's page)
//   elo:    Elo change shown under the date, e.g. "+7" or "±7"
export function matchRow(m, team, { right = "", status = "", elo = null } = {}) {
  const home = team(m.home_team_id), away = team(m.away_team_id);
  const played = m.home_goals != null;
  const pens = played && m.home_pens != null;
  const pill = !played ? "" : m.forfeit ? "FF" : pens ? "Pens" : "FT";
  const statusHtml = status || (pill ? `<span class="pill">${pill}</span>` : "");
  const eloHtml = elo == null ? "" : `<small class="fx-elo ${elo.cls ?? ""}">${elo.text}</small>`;
  const right_ = (right || (played ? shortDate(m.played_at) : "")) + eloHtml;
  const side = (t, club, cls) => `
    <span class="fx-team ${cls}">
      ${playerLink(t)}
      ${club ? `<small>${esc(club)}</small>` : ""}
    </span>`;
  return `
    <div class="fx-row${played ? "" : " upcoming"}${status ? " with-result" : ""}${m.forfeit ? " forfeit" : ""}"
         ${m.forfeit ? 'title="Forfeit: not played, counted as 3-0"' : ""}>
      <span class="fx-status">${statusHtml}</span>
      ${side(home, m.home_club, "home")}
      ${crestIcon(home)}
      <span class="fx-score">
        ${played ? `${m.home_goals} - ${m.away_goals}` : "vs"}
        ${pens ? `<small>${m.home_pens} - ${m.away_pens} pens</small>` : ""}
      </span>
      ${crestIcon(away)}
      ${side(away, m.away_club, "away")}
      <span class="fx-right">${right_}</span>
    </div>`;
}
