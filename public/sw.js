// Bump this whenever the cached shell should be thrown away; the activate
// handler deletes every cache that is not the current name.
const CACHE_NAME = "fundsflow-shell-v2";

// "/" is deliberately NOT precached. It is an authenticated page that redirects
// to /login when signed out, so precaching it at install time stores whichever
// of those two the installer happened to get, and serves it to an offline user
// later. Navigations are network-first and cached as they succeed, so the
// offline fallback is whatever this user actually saw last.
const SHELL_URLS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // One missing asset used to reject the whole install and leave the
      // worker uninstalled; cache what resolves and move on.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API calls — balances/transactions must always be fresh.
  if (url.pathname.startsWith("/api/")) return;

  // Static Next.js assets: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon-")) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    );
    return;
  }

  // Navigations and everything else: network-first, fall back to cached shell offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Never store redirects or errors: caching the /login redirect as the
        // home page is exactly how a stale shell gets served offline.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
