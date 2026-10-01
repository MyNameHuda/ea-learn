// Minimal service worker for PWA install prompt.
// Network-first, then cache fallback for static assets.

const CACHE = "ealearn-v1";
const CORE = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API or auth routes.
  //
  // The fallback below answers a failed request with the cached "/" page, which
  // is right for a navigation (show something useful while offline) and
  // catastrophic for an API call: /api/quiz/create would come back 200 with a
  // page of HTML, the client would fail to parse it as JSON, and the error
  // message would say nothing about what went wrong. These requests go straight
  // to the network and fail loudly, which is correct.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Only immutable, fingerprinted build output is worth caching. Caching
        // HTML would pin users to one deploy's markup and hide every update
        // until the cache name changed.
        if (res.ok && url.pathname.startsWith("/_next/static/")) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Offline fallback for navigations only — see above.
        if (event.request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
  );
});
