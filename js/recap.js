// Season card: a shareable 1080x1350 image of a player's season, drawn on a canvas.
// Shown in the "Season card" tab of a player's page. Made on the device; nothing is uploaded.

import { BY_KEY } from "./achievements.js";
import { LEAGUE } from "./config.js";
import { esc } from "./ui.js";

const W = 1080, H = 1350;
const ordinal = n => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const font = (size, weight = 400) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
const C = { bg: "#0f1115", panel: "#171a21", line: "#262b36", text: "#e8eaf0", muted: "#8a92a6",
            win: "#22c55e", draw: "#a3a3a3", loss: "#ef4444" };

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";  // needed so the finished card can be saved
    const done = ok => { clearTimeout(timer); resolve(ok ? img : null); };
    const timer = setTimeout(() => done(false), 4000);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = src;
  });
}

// Seasons this player has league or playoff games in, newest first.
export const seasonsFor = games =>
  [...new Set(games.filter(g => g.stage !== "friendly").map(g => g.season))].sort((a, b) => b - a);

// Everything the card shows, worked out from the player's games.
export function seasonSummary({ me, games, tableFor, ach }, season) {
  const inSeason = games.filter(g => g.season === season);
  const comp = inSeason.filter(g => g.stage !== "friendly" && !g.forfeit);
  if (!comp.length) return null;
  const w = comp.filter(g => g.result === "W").length;
  const d = comp.filter(g => g.result === "D").length;
  let run = 0, best = 0;
  for (const g of comp) { run = g.result === "W" ? run + 1 : 0; best = Math.max(best, run); }
  const big = comp.filter(g => g.gf > g.ga).sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)[0];

  // Elo across the season, friendlies included: the rating before its first game, then after each
  const first = games.indexOf(inSeason[0]);
  const eloStart = first > 0 ? games[first - 1].elo : LEAGUE.elo.start;
  const eloLine = [eloStart, ...inSeason.map(g => g.elo)];

  const table = tableFor(season);
  const pos = table.findIndex(r => r.team.id === me.id);
  const row = table[pos];
  const events = ach.events.filter(e => e.id === me.id && e.season === season);
  return {
    season, gp: comp.length, w, d, l: comp.length - w - d,
    gf: comp.reduce((a, g) => a + g.gf, 0), ga: comp.reduce((a, g) => a + g.ga, 0),
    cs: comp.filter(g => g.ga === 0).length, bestRun: best, big,
    eloLine, results: inSeason.map(g => g.forfeit ? "F" : g.result),
    pos: row && row.p ? pos + 1 : null, of: table.length, pts: row?.pts,
    champion: events.some(e => e.key === "champion"),
    badges: [...new Set(events.filter(e => BY_KEY.get(e.key).group !== "shame").map(e => e.key))],
  };
}

export async function drawCard({ me, team }, s) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const color = /^#[0-9a-f]{6}$/i.test(me.color ?? "") ? me.color : "#22c55e";

  // background, with the team color fading in from the top
  x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, 0, 560);
  g.addColorStop(0, color + "cc"); g.addColorStop(1, color + "00");
  x.fillStyle = g; x.fillRect(0, 0, W, 560);

  x.textAlign = "center";
  x.fillStyle = C.text; x.font = font(28, 600);
  x.fillText(`${LEAGUE.name.toUpperCase()} · SEASON ${s.season}`, W / 2, 70);

  // crest, or a colored circle with the initial
  const img = await loadImage(me.crest_url);
  const cy = 215, r = 105;
  if (img) {
    const k = Math.min(2 * r / img.width, 2 * r / img.height);
    x.drawImage(img, W / 2 - img.width * k / 2, cy - img.height * k / 2, img.width * k, img.height * k);
  } else {
    x.fillStyle = color; x.beginPath(); x.arc(W / 2, cy, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#fff"; x.font = font(100, 800); x.textBaseline = "middle";
    x.fillText((me.short_name || me.name)[0], W / 2, cy + 6); x.textBaseline = "alphabetic";
  }

  x.fillStyle = C.text;
  fitText(x, me.name, W / 2, 400, W - 120, 68, 800);
  if (me.owner_name) { x.fillStyle = C.muted; x.font = font(32); x.fillText(me.owner_name, W / 2, 448); }

  // headline: champion, or league position
  x.fillStyle = s.champion ? "#facc15" : C.text;
  const head = s.champion ? "🏆 CHAMPION" : s.pos ? `${ordinal(s.pos)} of ${s.of} · ${s.pts} pts` : `${s.gp} games played`;
  fitText(x, head, W / 2, 535, W - 120, 52, 800);

  // 3x2 stat grid
  const eloEnd = s.eloLine.at(-1), eloDiff = Math.round(eloEnd - s.eloLine[0]);
  const cells = [
    ["Record", `${s.w}-${s.d}-${s.l}`],
    ["Goals", `${s.gf}`],
    ["Conceded", `${s.ga}`],
    ["Clean sheets", `${s.cs}`],
    ["Elo", `${Math.round(eloEnd)} (${eloDiff >= 0 ? "+" : ""}${eloDiff})`],
    ["Best streak", `${s.bestRun} W`],
  ];
  const gx = 60, gy = 580, cw = (W - 120 - 40) / 3, ch = 135;
  cells.forEach(([label, value], i) => {
    const cx = gx + (i % 3) * (cw + 20), top = gy + Math.floor(i / 3) * (ch + 20);
    panel(x, cx, top, cw, ch);
    x.fillStyle = C.muted; x.font = font(26, 500); x.fillText(label, cx + cw / 2, top + 46);
    x.fillStyle = C.text;
    fitText(x, value, cx + cw / 2, top + 104, cw - 30, 46, 800);
  });

  // Elo through the season, one dot per game colored by result
  const py = gy + 2 * (ch + 20) + 10, ph = 190;
  panel(x, 60, py, W - 120, ph);
  x.textAlign = "left"; x.fillStyle = C.muted; x.font = font(24, 500);
  x.fillText("Elo this season", 90, py + 40);
  const vals = s.eloLine, lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(20, hi - lo);
  const lx = 90, rx = W - 90, ty = py + 62, by = py + ph - 24;
  const X = i => lx + (vals.length === 1 ? 0 : i * (rx - lx) / (vals.length - 1));
  const mid = (lo + hi) / 2;  // a flat season sits in the middle of the box
  const Y = v => (ty + by) / 2 - (v - mid) / span * (by - ty);
  x.strokeStyle = color; x.lineWidth = 5; x.lineJoin = "round"; x.beginPath();
  vals.forEach((v, i) => i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v)));
  x.stroke();
  if (vals.length <= 40) {
    s.results.forEach((r, i) => {
      x.fillStyle = r === "W" ? C.win : r === "L" ? C.loss : r === "D" ? C.draw : C.panel;
      x.beginPath(); x.arc(X(i + 1), Y(vals[i + 1]), 8, 0, Math.PI * 2); x.fill();
      x.strokeStyle = C.panel; x.lineWidth = 3; x.stroke();
    });
  }
  x.textAlign = "center";

  let y = py + ph + 60;
  if (s.big) {
    x.fillStyle = C.muted; x.font = font(30, 500);
    fitText(x, `Biggest win: ${s.big.gf}–${s.big.ga} vs ${team(s.big.opp)?.name ?? "?"}`, W / 2, y, W - 120, 30, 500);
    y += 55;
  }
  if (s.badges.length) {
    const icons = s.badges.slice(0, 9).map(k => BY_KEY.get(k).icon).join(" ") + (s.badges.length > 9 ? `  +${s.badges.length - 9}` : "");
    x.font = font(54); x.fillStyle = C.text;
    x.fillText(icons, W / 2, y + 20);
  }

  x.fillStyle = C.muted; x.font = font(24);
  x.fillText("alexbronstein16.github.io/fifa-league", W / 2, H - 36);
  return c;
}

function panel(x, l, t, w, h, r = 22) {
  x.beginPath();
  x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
  x.fillStyle = C.panel; x.fill();
  x.strokeStyle = C.line; x.lineWidth = 2; x.stroke();
}

// shrink a line of text until it fits
function fitText(x, text, cx, y, max, size, weight) {
  x.font = font(size, weight);
  while (size > 18 && x.measureText(text).width > max) x.font = font(size -= 2, weight);
  x.fillText(text, cx, y);
}

// The "Season card" tab: season picker, the card, and Share / Save.
export function cardTab(box, opts) {
  const seasons = seasonsFor(opts.games);
  if (!seasons.length) {
    box.innerHTML = `<p class="note">The season card appears after a league or playoff game.</p>`;
    return;
  }
  let season = seasons.includes(opts.current) ? opts.current : seasons[0];
  let url = null;

  async function draw() {
    box.innerHTML = `
      ${seasons.length > 1 ? `<div class="filters">${seasons.map(n =>
        `<button class="chip" data-season="${n}" aria-pressed="${n === season}">Season ${n}</button>`).join("")}</div>` : ""}
      <div class="card-view"><p class="note">Making the card…</p></div>`;
    const view = box.querySelector(".card-view");
    try {
      const s = seasonSummary(opts, season);
      const canvas = await drawCard(opts, s);
      const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      const name = `${opts.me.name.replace(/[^\w]+/g, "-")}-season-${season}.png`;
      const file = new File([blob], name, { type: "image/png" });
      const canShare = !!navigator.canShare?.({ files: [file] });
      view.innerHTML = `
        <img src="${url}" alt="${esc(opts.me.name)}, season ${season}">
        <div class="card-actions">
          ${canShare ? `<button id="card-share">Share</button>` : ""}
          <a class="btn" href="${url}" download="${esc(name)}">Save image</a>
        </div>`;
      view.querySelector("#card-share")?.addEventListener("click", () =>
        navigator.share({ files: [file], title: `${opts.me.name} · Season ${season}` }).catch(() => {}));
    } catch (err) {
      view.innerHTML = `<p class="note">Couldn't make the card.</p>`;
      console.error(err);
    }
  }

  box.addEventListener("click", e => {
    const chip = e.target.closest("[data-season]");
    if (!chip) return;
    season = Number(chip.dataset.season);
    draw();
  });
  draw();
}
