const CACHE_NAME = "nine-cinejoy-v45";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./404.html",
  "./manifest.json?v=43.0",
  "./favicon.ico?v=43.0",
  "./css/style.css?v=43.0",
  "./js/config.js?v=43.0",
  "./js/tmdb.js?v=43.0",
  "./js/anilist.js?v=43.0",
  "./js/watchlist.js?v=43.0",
  "./js/history.js?v=43.0",
  "./js/player.js?v=43.0",
  "./js/livetv.js?v=43.0",
  "./js/app.js?v=43.0",
  "./icons/cinejoy-icon.svg?v=43.0",
  "./icons/cinejoy-logo.svg?v=43.0",
  "./icons/icon-192.png?v=43.0",
  "./icons/icon-512.png?v=43.0"
];

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// During local development, self-unregister, purge all caches and always fetch fresh from network
if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", event => {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim())
    );
  });
  self.addEventListener("fetch", event => {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
  });
} else {
  // Install: Cache core static assets & skip waiting immediately
  self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll(CORE_ASSETS);
      })
    );
  });

  // Activate: Purge old cache versions immediately
  self.addEventListener("activate", event => {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      ).then(() => self.clients.claim())
    );
  });

  // Fetch: Smart caching strategy
  self.addEventListener("fetch", event => {
    const req = event.request;
    const url = new URL(req.url);

    // Skip non-GET requests, Chrome extension calls, video streams, and Google site verification
    if (req.method !== "GET" || !url.protocol.startsWith("http")) return;
    if (url.protocol === "chrome-extension:") return;
    if (url.pathname.includes("google9adbe8113470ae95.html")) return;
    if (url.pathname.includes("/api/extensions/proxy")) return;
    if (url.hostname.includes("googlevideo.com") || url.pathname.endsWith(".m3u8") || url.pathname.endsWith(".ts")) return;

    // TMDB & AniList API Calls: Network First with cache fallback
    if (url.hostname.includes("api.themoviedb.org") || url.hostname.includes("graphql.anilist.co")) {
      event.respondWith(
        fetch(req)
          .then(res => {
            if (res.ok) {
              const resClone = res.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
            }
            return res;
          })
          .catch(() => caches.match(req))
      );
      return;
    }

    // Static Assets: Network-first to always prioritize freshest code
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  });
}
