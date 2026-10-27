// Season card: a shareable 1080x1350 image of a player's season, drawn on a canvas.
// Made on the phone when the button is pressed; nothing is uploaded anywhere.

import { BY_KEY } from "./achievements.js";
import { LEAGUE } from "./config.js";
import { esc } from "./ui.js";

const W = 1080, H = 1350;
const ordinal = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";  // crests from storage must allow this, or the image can't be saved
    const done = ok => { clearTimeout(timer); resolve(ok ? img : null); };
    const timer = setTimeout(() => done(false), 4000);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = src;
  });
}

// Everything the card shows, worked out from the player's games.
export function seasonSummary({ me, games, table, ach, season }) {
  const inSeason = games.filter(g => g.season === season);
  const comp = inSeason.filter(g => g.stage !== "friendly" && !g.forfeit);
  if (!comp.length) return null;
  const w = comp.filter(g => g.result === "W").length;
  const d = comp.filter(g => g.result === "D").length;
  let run = 0, best = 0;
  for (const g of comp) { run = g.result === "W" ? run + 1 : 0; best = Math.max(best, run); }
  const big = comp.filter(g => g.gf > g.ga).sort((a, b) => (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)[0];

  // Elo across the season: before its first game to after its last (friendlies included)
  const first = games.indexOf(inSeason[0]);
  const eloStart = first > 0 ? games[first - 1].elo : LEAGUE.elo.start;
  const eloEnd = inSeason.at(-1).elo;

  const pos = table.findIndex(r => r.team.id === me.id);
  const row = table[pos];
  const events = ach.events.filter(e => e.id === me.id && e.season === season);
  return {
    gp: comp.length, w, d, l: comp.length - w - d,
    gf: comp.reduce((a, g) => a + g.gf, 0), ga: comp.reduce((a, g) => a + g.ga, 0),
    cs: comp.filter(g => g.ga === 0).length, bestRun: best, big,
    eloStart, eloEnd,
    pos: row && row.p ? pos + 1 : null, of: table.length, pts: row?.pts,
    champion: events.some(e => e.key === "champion"),
    badges: [...new Set(events.filter(e => BY_KEY.get(e.key).group !== "shame").map(e => e.key))],
  };
}

export async function drawCard({ me, team, season }, s) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const font = (size, weight = 400) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const color = me.color || "#22c55e";

  // background with the team color fading in from the top
  x.fillStyle = "#0f1115"; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, 0, 620);
  g.addColorStop(0, color + "cc"); g.addColorStop(1, color + "00");
  x.fillStyle = g; x.fillRect(0, 0, W, 620);

  x.textAlign = "center";
  x.fillStyle = "#e8eaf0";
  x.font = font(30, 600);
  x.fillText(`${LEAGUE.name.toUpperCase()} · SEASON ${season}`, W / 2, 80);

  // crest, or a colored circle with the initial
  const img = await loadImage(me.crest_url);
  const cy = 250, r = 120;
  if (img) {
    const k = Math.min(2 * r / img.width, 2 * r / img.height);
    x.drawImage(img, W / 2 - img.width * k / 2, cy - img.height * k / 2, img.width * k, img.height * k);
  } else {
    x.fillStyle = color; x.beginPath(); x.arc(W / 2, cy, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#fff"; x.font = font(110, 800); x.textBaseline = "middle";
    x.fillText((me.short_name || me.name)[0], W / 2, cy + 6); x.textBaseline = "alphabetic";
  }

  x.fillStyle = "#e8eaf0"; x.font = font(72, 800);
  fitText(x, me.name, W / 2, 450, W - 120, 72, font);
  if (me.owner_name) { x.fillStyle = "#8a92a6"; x.font = font(34); x.fillText(me.owner_name, W / 2, 505); }

  // headline: champion, or league position
  x.font = font(54, 800);
  x.fillStyle = s.champion ? "#facc15" : "#e8eaf0";
  const head = s.champion ? "🏆 CHAMPION" : s.pos ? `${ordinal(s.pos)} of ${s.of} · ${s.pts} pts` : `${s.gp} games played`;
  x.fillText(head, W / 2, 610);

  // 3x2 stat grid
  const eloDiff = Math.round(s.eloEnd - s.eloStart);
  const cells = [
    ["Record", `${s.w}-${s.d}-${s.l}`],
    ["Goals", `${s.gf}`],
    ["Conceded", `${s.ga}`],
    ["Clean sheets", `${s.cs}`],
    ["Elo", `${Math.round(s.eloEnd)} (${eloDiff >= 0 ? "+" : ""}${eloDiff})`],
    ["Best streak", `${s.bestRun} W`],
  ];
  const gx = 60, gy = 670, cw = (W - 120 - 40) / 3, ch = 150;
  cells.forEach(([label, value], i) => {
    const cx = gx + (i % 3) * (cw + 20), top = gy + Math.floor(i / 3) * (ch + 20);
    roundRect(x, cx, top, cw, ch, 22); x.fillStyle = "#171a21"; x.fill();
    x.strokeStyle = "#262b36"; x.lineWidth = 2; x.stroke();
    x.fillStyle = "#8a92a6"; x.font = font(28, 500); x.fillText(label, cx + cw / 2, top + 50);
    x.fillStyle = "#e8eaf0"; x.font = font(48, 800);
    fitText(x, value, cx + cw / 2, top + 112, cw - 30, 48, font);
  });

  let y = gy + 2 * (ch + 20) + 60;
  if (s.big) {
    x.fillStyle = "#8a92a6"; x.font = font(32, 500);
    x.fillText(`Biggest win: ${s.big.gf}–${s.big.ga} vs ${team(s.big.opp)?.name ?? "?"}`, W / 2, y);
    y += 70;
  }

  if (s.badges.length) {
    x.fillStyle = "#8a92a6"; x.font = font(28, 500);
    x.fillText(`${s.badges.length} achievement${s.badges.length === 1 ? "" : "s"} unlocked`, W / 2, y);
    const icons = s.badges.slice(0, 8).map(k => BY_KEY.get(k).icon).join("  ") + (s.badges.length > 8 ? `  +${s.badges.length - 8}` : "");
    x.font = font(64); x.fillStyle = "#e8eaf0";
    x.fillText(icons, W / 2, y + 85);
  }

  x.fillStyle = "#8a92a6"; x.font = font(26);
  x.fillText("alexbronstein16.github.io/fifa-league", W / 2, H - 50);
  return c;
}

// shrink a line of text until it fits
function fitText(x, text, cx, y, max, size, font) {
  const weight = x.font.split(" ")[0];
  while (size > 18 && x.measureText(text).width > max) { size -= 2; x.font = font(size, weight); }
  x.fillText(text, cx, y);
}

function roundRect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}

// Adds the "Season card" button under the profile header.
export function recapButton(box, opts) {
  const s = seasonSummary(opts);
  if (!s) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="recap-actions"><button class="secondary" id="recap-make">📸 Season ${opts.season} card</button></div>
    <div class="recap-preview" id="recap-preview" hidden></div>`;
  const prev = box.querySelector("#recap-preview");
  box.querySelector("#recap-make").addEventListener("click", async e => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = "Making card…";
    try {
      const canvas = await drawCard(opts, s);
      const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
      const url = URL.createObjectURL(blob);
      const name = `${opts.me.name.replace(/[^\w]+/g, "-")}-season-${opts.season}.png`;
      const file = new File([blob], name, { type: "image/png" });
      const canShare = navigator.canShare?.({ files: [file] });
      prev.hidden = false;
      prev.innerHTML = `<img src="${url}" alt="${esc(opts.me.name)} season ${opts.season} card">
        <div class="recap-actions" style="margin-top:8px">
          ${canShare ? `<button id="recap-share">Share</button>` : ""}
          <a class="btn" href="${url}" download="${esc(name)}">Save image</a>
        </div>`;
      prev.querySelector("#recap-share")?.addEventListener("click", () =>
        navigator.share({ files: [file], title: `${opts.me.name} · Season ${opts.season}` }).catch(() => {}));
      btn.textContent = "📸 Remake card";
    } catch (err) {
      btn.textContent = "Couldn't make the card";
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });
}
