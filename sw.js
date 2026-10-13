// Service worker: makes the home-screen app open fast and keep working offline.
//
// Pages, code and league data: try the network first so everyone always sees the
// latest version and scores. If the network is slow (over 4 seconds) or offline,
// fall back to the last copy saved on the phone.
// Crests, logo and the Supabase library: served from the phone's copy, since they
// rarely change. Bump VERSION after replacing an image to make phones re-download.

const VERSION = "v1";
const CACHE = `league-${VERSION}`;
const TIMEOUT_MS = 4000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;  // never touch logins, reports or approvals
  const url = new URL(req.url);

  // league data: only the public tables, never auth or admin-only data
  if (url.hostname.endsWith(".supabase.co")) {
    if (/^\/rest\/v1\/(teams|matches)\b/.test(url.pathname)) event.respondWith(networkFirst(req));
    // crests uploaded from admin get a new file name every time, so they never go stale
    else if (url.pathname.startsWith("/storage/v1/object/public/crests/")) event.respondWith(cacheFirst(req));
    return;
  }

  // the pinned Supabase library never changes for a given version
  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (/\.(png|jpe?g|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  // "no-cache" checks the server for a newer version every time, which also ends
  // the need for hard refreshes after an update
  const network = fetch(req, { cache: "no-cache" }).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });

  const timeout = new Promise(resolve => setTimeout(resolve, TIMEOUT_MS, null));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch {
    // offline: fall through to the saved copy
  }
  // pages like player.html?id=3 fall back to any saved copy of player.html
  const saved = await cache.match(req) ?? await cache.match(req, { ignoreSearch: true });
  return saved ?? network;  // nothing saved yet: keep waiting on the network
}
