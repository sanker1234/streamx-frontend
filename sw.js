const CACHE_NAME = "streamx-cinema-v6";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css?v=6.0",
  "./js/config.js?v=6.0",
  "./js/tmdb.js?v=6.0",
  "./js/anilist.js?v=6.0",
  "./js/watchlist.js?v=6.0",
  "./js/history.js?v=6.0",
  "./js/player.js?v=6.0",
  "./js/app.js?v=6.0",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

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

  // Skip non-GET requests, Chrome extension calls, and video streams/hls chunks
  if (req.method !== "GET" || !url.protocol.startsWith("http")) return;
  if (url.pathname.endsWith(".m3u8") || url.pathname.endsWith(".ts") || url.pathname.endsWith(".mp4")) return;

  // For API requests (TMDB, AniList, streamx-backend): Network-first
  if (url.pathname.includes("/api/") || url.hostname.includes("themoviedb.org") || url.hostname.includes("anilist.co")) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // For static shell assets: Network-first, fallback to cache
  event.respondWith(
    fetch(req).then(networkResponse => {
      if (networkResponse && networkResponse.status === 200 && req.url.startsWith(self.location.origin)) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(req).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        if (req.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});