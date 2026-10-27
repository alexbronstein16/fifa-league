// One list of pages, used by every page. Add a tab here once and it appears everywhere.
const PAGES = [
  ["index.html", "Home"],
  ["standings.html", "Standings"],
  ["fixtures.html", "Fixtures"],
  ["playoffs.html", "Playoffs"],
  ["friendlies.html", "Friendlies"],
  ["h2h.html", "H2H"],
  ["stats.html", "Stats"],
  ["report.html", "Report"],
];

const here = location.pathname.split("/").pop() || "index.html";

document.getElementById("nav").innerHTML =
  `<a href="index.html" class="brand"><img src="img/logo.png" alt="Home" width="32" height="32"></a>` +
  PAGES.map(([href, label]) =>
    `<a href="${href}"${href === here ? ' class="active"' : ""}>${label}</a>`
  ).join("");

// Offline support for the home-screen app (see sw.js)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Tell people when they're looking at saved data
const offlineNote = () => {
  let el = document.getElementById("offline-note");
  if (navigator.onLine) { el?.remove(); return; }
  if (el) return;
  el = document.createElement("div");
  el.id = "offline-note";
  el.className = "offline-note";
  el.textContent = "You're offline. Showing the last saved scores.";
  document.getElementById("nav").after(el);
};
offlineNote();
addEventListener("online", offlineNote);
addEventListener("offline", offlineNote);
