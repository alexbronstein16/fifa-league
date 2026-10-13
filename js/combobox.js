import { esc, cleanClub } from "./ui.js";
import { CLUB_ALIASES } from "./config.js";

// Lowercase, strip accents and punctuation: "Atlético  Madrid!" -> "atletico madrid"
const norm = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// How well `name` matches the query (lower is better, -1 = no match).
//   0  name starts with it:        "man"      -> Manchester City
//   1  each word starts a word:    "man city" -> Manchester City
//      or it's the initials:       "rm"       -> Real Madrid
//   2  it appears anywhere:        "chest"    -> Manchester City
function score(name, q) {
  const n = norm(name);
  if (!q) return 0;
  if (n.startsWith(q)) return 0;
  const words = n.split(" ");
  const parts = q.split(" ");
  let w = 0;
  const allPrefix = parts.every(p => {
    while (w < words.length && !words[w].startsWith(p)) w++;
    return w++ < words.length;
  });
  if (allPrefix) return 1;
  if (!q.includes(" ") && words.map(x => x[0]).join("") === q) return 1;
  if (n.includes(q)) return 2;
  return -1;
}

// Turns a text input into a searchable picker.
// `options` is an array of names shared by every picker on the page,
// so a club added in one box shows up in the others right away.
export function combobox(input, options, { max = 8, aliases = CLUB_ALIASES } = {}) {
  const list = document.createElement("ul");
  list.className = "combo-list";
  list.id = `${input.id}-list`;
  list.setAttribute("role", "listbox");
  list.hidden = true;
  input.after(list);
  input.parentElement.classList.add("combo");

  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  // alias lookups, both directions
  const aliasToClub = new Map(Object.entries(aliases).map(([a, c]) => [norm(a), c]));
  const clubAliases = new Map();
  for (const [a, c] of Object.entries(aliases)) {
    const key = norm(c);
    clubAliases.set(key, [...(clubAliases.get(key) ?? []), a]);
  }

  let items = [];
  let active = -1;

  // the stored spelling for what was typed: exact name (any capitals) or a nickname
  const known = value => {
    const v = norm(value);
    if (!v) return null;
    const direct = options.find(o => norm(o) === v);
    if (direct) return direct;
    const club = aliasToClub.get(v);
    if (!club) return null;
    return options.find(o => norm(o) === norm(club)) ?? club;
  };

  // best score across the club's name and its nicknames
  const best = (name, q) => {
    const scores = [name, ...(clubAliases.get(norm(name)) ?? [])]
      .map(x => score(x, q)).filter(s => s >= 0);
    return scores.length ? Math.min(...scores) : -1;
  };

  function open() {
    const typed = cleanClub(input.value) ?? "";
    const q = norm(typed);
    // keep popularity order within each score tier
    items = options
      .map((name, i) => ({ name, s: best(name, q), i }))
      .filter(x => x.s >= 0)
      .sort((a, b) => a.s - b.s || a.i - b.i)
      .slice(0, max)
      .map(x => ({ name: x.name, add: false }));
    // a nickname for a club nobody has used yet still shows the real name
    const viaAlias = aliasToClub.get(q);
    if (viaAlias && !items.some(it => norm(it.name) === norm(viaAlias))) {
      items.unshift({ name: viaAlias, add: false });
    }
    if (typed && !known(typed)) items.push({ name: typed, add: true });
    active = typed && items.length ? 0 : -1;  // only pre-highlight once they've typed
    draw();
  }

  function draw() {
    list.innerHTML = items.map((it, i) => `
      <li role="option" data-i="${i}"
          class="${i === active ? "active" : ""}${it.add ? " add" : ""}"
          aria-selected="${i === active}">
        ${it.add ? `+ Add “${esc(it.name)}”` : esc(it.name)}
      </li>`).join("");
    list.hidden = !items.length;
    input.setAttribute("aria-expanded", String(!list.hidden));
  }

  function close() {
    list.hidden = true;
    active = -1;
    input.setAttribute("aria-expanded", "false");
  }

  function choose(i) {
    const it = items[i];
    if (!it) return;
    if (!options.some(o => norm(o) === norm(it.name))) options.unshift(it.name);
    input.value = it.name;
    close();
  }

  input.addEventListener("focus", open);
  input.addEventListener("input", open);

  input.addEventListener("keydown", e => {
    if (list.hidden) {
      if (e.key === "ArrowDown") { open(); e.preventDefault(); }
      return;
    }
    const n = items.length;
    if (e.key === "ArrowDown") {
      active = (active + 1) % n;
      draw();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      active = active <= 0 ? n - 1 : active - 1;
      draw();
      e.preventDefault();
    } else if (e.key === "Enter" && active >= 0) {
      choose(active);
      e.preventDefault();  // pick the club instead of submitting the form
    } else if (e.key === "Escape") {
      close();
    }
  });

  // pointerdown fires before the input loses focus, so the list is still there
  list.addEventListener("pointerdown", e => {
    const li = e.target.closest("li");
    if (!li) return;
    e.preventDefault();
    choose(Number(li.dataset.i));
  });

  input.addEventListener("blur", () => {
    close();
    const match = known(input.value);
    if (match) input.value = match;  // "real madrid" or "PSG" -> stored spelling
  });
}
