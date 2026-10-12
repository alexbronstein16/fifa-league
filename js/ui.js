export const esc = s => String(s ?? "").replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Team crest if there is one, otherwise their color dot.
export const badge = t => t?.crest_url
  ? `<img class="crest" src="${esc(t.crest_url)}" alt="">`
  : `<span class="dot" style="background:${esc(t?.color)}"></span>`;
