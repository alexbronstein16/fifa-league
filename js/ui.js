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

// <option>s for the club autocomplete: clubs already used (most-used first),
// then the starter list. Grouped case-insensitively.
export function clubOptions(matches, suggestions = []) {
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
    .map(c => `<option value="${esc(c.name)}"></option>`)
    .join("");
}
