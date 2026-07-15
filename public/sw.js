/*
 * Darts Training Analyzer - Service Worker
 * 方針:
 *  - install 時にアプリシェルをキャッシュ
 *  - 同一オリジンの GET はキャッシュ優先 + バックグラウンド更新 (stale-while-revalidate)
 *  - ナビゲーションはネットワーク失敗時に index.html へフォールバック
 *  - 新しい SW が waiting になったらクライアントへ更新可能を通知
 */
const CACHE_VERSION = "dta-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put("./index.html", response.clone());
          return response;
        } catch {
          const cached = await caches.match("./index.html");
          if (cached) return cached;
          return new Response("offline", { status: 503 });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const fetchAndCache = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);
      if (cached) {
        fetchAndCache.catch(() => undefined);
        return cached;
      }
      const fresh = await fetchAndCache;
      if (fresh) return fresh;
      return new Response("offline", { status: 503 });
    })()
  );
});
