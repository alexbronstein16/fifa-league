// One list of pages, used by every page. Add a tab here once and it appears everywhere.
const PAGES = [
  ["index.html", "Home"],
  ["standings.html", "Standings"],
  ["playoffs.html", "Playoffs"],
  ["friendlies.html", "Friendlies"],
  ["report.html", "Report"],
];

const here = location.pathname.split("/").pop() || "index.html";

document.getElementById("nav").innerHTML =
  ``<a href="index.html" class="brand"><img src="img/logo.png" alt="Home" width="32" height="32"></a>` +`
  PAGES.map(([href, label]) =>
    `<a href="${href}"${href === here ? ' class="active"' : ""}>${label}</a>`
  ).join("");
