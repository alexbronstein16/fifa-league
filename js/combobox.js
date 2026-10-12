import { esc, cleanClub } from "./ui.js";

// Turns a text input into a searchable picker.
// `options` is an array of names shared by every picker on the page,
// so a club added in one box shows up in the others right away.
export function combobox(input, options, { max = 8 } = {}) {
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

  let items = [];
  let active = -1;

  // the existing spelling of a name, ignoring capitals
  const known = value => {
    const v = (cleanClub(value) ?? "").toLowerCase();
    return options.find(o => o.toLowerCase() === v);
  };

  function open() {
    const typed = cleanClub(input.value) ?? "";
    const q = typed.toLowerCase();
    items = options
      .filter(o => o.toLowerCase().includes(q))
      .slice(0, max)
      .map(name => ({ name, add: false }));
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
    if (it.add) options.unshift(it.name);  // put new clubs at the top for the other box
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
    if (match) input.value = match;  // "real madrid" -> "Real Madrid"
  });
}
